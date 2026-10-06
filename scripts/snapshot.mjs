#!/usr/bin/env node
// Capture a data+pages snapshot of the planner into the stellaris-data-comparison
// repo, for version-to-version diffing and regression checks.
//
//   pnpm snapshot            # generate the snapshot, stage it, print the commit cmd
//   pnpm snapshot --commit   # ...and commit it in the comparison repo
//
// The snapshot is written to:
//   <comparison>/versions/<gameVersion>_extract-<sha>_planner-<sha>/
//     data/<table>.json   normalized dump of every SQLite table (sorted, stable)
//     pages/<route>.html  SSR HTML of every static route (hash-normalized + pretty)
//     stellaris.sql       the extractor's git-tracked plain-text dump (recreates the DB)
//     manifest.json       full SHAs, game version, route list, timestamp
// Plus a per-minor-version capture checklist at <comparison>/patchnotes/<v4.4>.md
// (shared across that version line's snapshots; seeded with a skeleton if absent).
//
// Preflight: BOTH source repos (extractor + planner) must have clean working trees,
// so the SHAs encoded in the directory name truly describe what produced the output.
//
// Diff any two snapshots with:  git -C <comparison> diff --no-index versions/<A> versions/<B>

import { execFileSync, spawn } from 'node:child_process';
import {
	readFileSync,
	writeFileSync,
	copyFileSync,
	statSync,
	mkdirSync,
	rmSync,
	existsSync,
	readdirSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import prettier from 'prettier';

// Self-locating: this script lives in <planner>/scripts/, its siblings next to <planner>.
const PLANNER = dirname(dirname(fileURLToPath(import.meta.url)));
const WORKSPACE = dirname(PLANNER);
const EXTRACTOR = join(WORKSPACE, 'stellaris-data-extraction');
const COMPARISON = process.env.COMPARISON_DIR || join(WORKSPACE, 'stellaris-data-comparison');
const PORT = Number(process.env.SNAPSHOT_PORT || 4319);
const DO_COMMIT = process.argv.includes('--commit');

const die = (msg) => {
	console.error(`✗ ${msg}`);
	process.exit(1);
};
const git = (repo, ...args) =>
	execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();

// ── Preflight: source repos must be clean ──────────────────────────────────────
for (const [name, repo] of [
	['extractor', EXTRACTOR],
	['planner', PLANNER]
]) {
	if (!existsSync(join(repo, '.git'))) die(`${name} is not a git repo at ${repo}`);
	if (git(repo, 'status', '--porcelain')) {
		die(`${name} (${repo}) has uncommitted changes — commit or stash before snapshotting.`);
	}
}
if (!existsSync(join(COMPARISON, '.git'))) die(`comparison repo not found at ${COMPARISON}`);

const extShort = git(EXTRACTOR, 'rev-parse', '--short', 'HEAD');
const plnShort = git(PLANNER, 'rev-parse', '--short', 'HEAD');

// ── Resolve the SQLite DB (env, else planner .env) ─────────────────────────────
function dbPath() {
	if (process.env.STELLARIS_DB) return process.env.STELLARIS_DB;
	const m = readFileSync(join(PLANNER, '.env'), 'utf8').match(/^STELLARIS_DB=(.+)$/m);
	if (!m) die('STELLARIS_DB not set and not found in planner .env');
	return m[1].trim();
}
const DB = dbPath();
if (!existsSync(DB)) die(`SQLite DB not found at ${DB}`);

const db = new Database(DB, { readonly: true, fileMustExist: true });
const meta = Object.fromEntries(
	db
		.prepare("SELECT key, value FROM meta WHERE key IN ('game_version', 'game_version_raw')")
		.all()
		.map((r) => [r.key, r.value])
);
const rawVer = meta.game_version_raw || 'unknown';

const dirName = `${rawVer}_extract-${extShort}_planner-${plnShort}`;
const outDir = join(COMPARISON, 'versions', dirName);
console.log(`→ snapshot ${dirName}`);

// Fresh data/ and pages/ so a re-run never leaves stale files behind.
for (const sub of ['data', 'pages']) rmSync(join(outDir, sub), { recursive: true, force: true });
mkdirSync(join(outDir, 'data'), { recursive: true });
mkdirSync(join(outDir, 'pages'), { recursive: true });

// ── 1. Dump every table → normalized JSON ──────────────────────────────────────
const tables = db
	.prepare(
		"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
	)
	.all()
	.map((r) => r.name);
for (const t of tables) {
	const rows = db.prepare(`SELECT * FROM "${t}"`).all();
	// Stable order independent of physical row order, so diffs reflect real changes.
	rows.sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
	writeFileSync(join(outDir, 'data', `${t}.json`), JSON.stringify(rows, null, 2) + '\n');
}
db.close();

// Copy the extractor's plain-text SQL dump — text, so it diffs in git and recreates the
// DB (sqlite3 new.db < stellaris.sql). It's git-tracked in the extractor, so it always
// matches extract-<sha>. The data/*.json dump is the per-table sorted view on top.
const sqlSrc = join(EXTRACTOR, 'sql', 'stellaris.sql');
if (!existsSync(sqlSrc)) die(`SQL dump not found at ${sqlSrc}`);
copyFileSync(sqlSrc, join(outDir, 'stellaris.sql'));
const sqlBytes = statSync(sqlSrc).size;
console.log(`  data: ${tables.length} tables + stellaris.sql (${(sqlBytes / 1e6).toFixed(1)} MB)`);

// ── 2. Build + serve the planner, snapshot every static route ──────────────────
const routes = discoverRoutes(join(PLANNER, 'src', 'routes'));
console.log('  building planner…');
execFileSync('pnpm', ['build'], { cwd: PLANNER, stdio: 'inherit' });

const server = spawn('node', ['build'], {
	cwd: PLANNER,
	env: { ...process.env, STELLARIS_DB: DB, PORT: String(PORT), HOST: '127.0.0.1' },
	stdio: 'inherit'
});
const cleanup = () => server.kill('SIGTERM');
process.on('exit', cleanup);

try {
	await waitForServer(`http://127.0.0.1:${PORT}/`);
	for (const route of routes) {
		const res = await fetch(`http://127.0.0.1:${PORT}${route}`);
		const raw = await res.text();
		if (!res.ok) console.warn(`  ! ${route} returned ${res.status}`);
		const html = await prettier.format(normalize(raw), { parser: 'html' });
		writeFileSync(join(outDir, 'pages', routeToFile(route)), html);
	}
	console.log(`  pages: ${routes.length} routes`);
} finally {
	cleanup();
}

// ── 3. Manifest + patchnotes ───────────────────────────────────────────────────
writeFileSync(
	join(outDir, 'manifest.json'),
	JSON.stringify(
		{
			game_version: meta.game_version ?? null,
			game_version_raw: rawVer,
			extractor: { short: extShort, sha: git(EXTRACTOR, 'rev-parse', 'HEAD') },
			planner: { short: plnShort, sha: git(PLANNER, 'rev-parse', 'HEAD') },
			sql_dump: { file: 'stellaris.sql', bytes: sqlBytes },
			tables,
			routes,
			generated_at: new Date().toISOString()
		},
		null,
		2
	) + '\n'
);

// Patch-note capture checklist lives at the repo root, keyed by the minor version line
// (v4.4.1 → v4.4) — it spans every snapshot of that line and is ticked over time, so it
// must NOT be duplicated per snapshot dir. Seeded with a skeleton only if absent.
const minorVer = rawVer.match(/^v?\d+\.\d+/)?.[0] ?? rawVer;
const patchnotes = join(COMPARISON, 'patchnotes', `${minorVer}.md`);
if (!existsSync(patchnotes)) {
	mkdirSync(dirname(patchnotes), { recursive: true });
	writeFileSync(patchnotes, patchnotesTemplate(minorVer));
}

// ── 4. Stage (and optionally commit) in the comparison repo ────────────────────
git(COMPARISON, 'add', '-A', join('versions', dirName), patchnotes);
const msg = `${rawVer} | extract ${extShort} | planner ${plnShort}`;
if (DO_COMMIT) {
	execFileSync('git', ['-C', COMPARISON, 'commit', '-m', msg], { stdio: 'inherit' });
	console.log(`✓ committed: ${msg}`);
} else {
	console.log(`✓ staged ${dirName}`);
	console.log(`  commit with:  git -C ${COMPARISON} commit -m ${JSON.stringify(msg)}`);
}

// ── helpers ─────────────────────────────────────────────────────────────────────

// Static routes only: directories under src/routes that have a +page.svelte and no
// [dynamic] segment (those can't be fetched without a parameter value). Route groups
// like (app) are stripped from the URL.
function discoverRoutes(root) {
	const out = [];
	const walk = (abs, url) => {
		const entries = readdirSync(abs, { withFileTypes: true });
		if (entries.some((e) => e.isFile() && e.name === '+page.svelte')) out.push(url || '/');
		for (const e of entries) {
			if (!e.isDirectory()) continue;
			if (e.name.startsWith('[')) continue; // dynamic segment — skip
			const seg = e.name.startsWith('(') ? '' : `/${e.name}`; // route group → no URL segment
			walk(join(abs, e.name), url + seg);
		}
	};
	walk(root, '');
	return [...new Set(out)].sort();
}

function routeToFile(route) {
	return route === '/' ? 'index.html' : route.replace(/^\//, '').replace(/\//g, '__') + '.html';
}

// Strip per-build volatile bits so a diff reflects real content changes, not new hashes.
function normalize(html) {
	return html
		.replace(/\/_app\/immutable\/[^"']+/g, '/_app/immutable/HASH')
		.replace(/__sveltekit_[a-z0-9]+/g, '__sveltekit_HASH')
		.replace(/(nonce=")[^"]*"/g, '$1NONCE"');
}

async function waitForServer(url, timeoutMs = 30000) {
	const start = Date.now();
	for (;;) {
		try {
			await fetch(url);
			return;
		} catch {
			if (Date.now() - start > timeoutMs) die('planner server did not start in time');
			await new Promise((r) => setTimeout(r, 250));
		}
	}
}

function patchnotesTemplate(ver) {
	return `# Stellaris ${ver} — capture checklist

Source: <paste the official patch-notes URL>

Tick each announced change once you've confirmed it shows up in this snapshot's
\`data/\` (or \`pages/\`). Unchecked boxes flag either an extractor gap or a change
that doesn't surface in the planner.

## Economy
- [ ] <change> — verify \`data/<table>.json\`

## Jobs
- [ ]

## Civics / Origins
- [ ]

## Traits / Species
- [ ]

## Other
- [ ]
`;
}
