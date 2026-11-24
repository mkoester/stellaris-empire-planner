# stellaris-empire-planner

SvelteKit 3 / Svelte 5 / SkeletonUI v4 / Tailwind v4 / TypeScript / pnpm. Reads the SQLite DB built
by the sibling `stellaris-data-extraction` repo.

Cross-project conventions come from the OKF vault; workspace rules from `../AGENTS.md`. **The full
DB schema, the `src/lib/server/db/` package layout and the per-route state machines are in
`docs/design-notes.md`** — that is the working spec for the 25+ tables and every route, so read it
before changing a query or a page.

## Running it

DB path comes from `STELLARIS_DB` in the gitignored `.env`, pointing at
`../stellaris-data-extraction/sqlite/stellaris.sqlite` (absolute).

**⚠ `.env` is a `denyRead` target, so a sandboxed `pnpm dev` reads it as empty and dies with
`STELLARIS_DB is not set`.** That is the sandbox, not a misconfiguration. Pass it explicitly:

```sh
STELLARIS_DB=<abs path>/stellaris-data-extraction/sqlite/stellaris.sqlite pnpm dev --port 5201
```

Two consequences when driving the app this way, both harmless and both easy to misread as bugs:

- Vite logs a `.env changed, restarting server...` loop against the stub.
- Prettier reports `EACCES` on `.mcp.json` (another stub), so **`pnpm lint` exits non-zero for a
  reason unrelated to the code** — read the file list it prints before believing it.

Start the server and make the requests **in one Bash command**; that is general sandbox behaviour
covered by the vault's `claude-sandbox` skill, not a planner quirk.

**A worktree has no `.env`, so there is no stub and no loop:** `pnpm dev` there (with
`STELLARIS_DB` passed) answers normally — the easy way to check dev-only output such as Svelte's
`node_invalid_placement_ssr` warnings. Don't symlink `node_modules` into a worktree for checks:
`$app/tsconfig` then resolves into the other checkout and `svelte-check` reports missing `./$types`.

When the restart loop makes the dev server answer 500/504, smoke-test a production build
instead (in one command): `STELLARIS_DB=… pnpm build`, then `STELLARIS_DB=… PORT=5202 node build`
and `curl` the routes. That needs no `.env`.

**Open check (2026-10-27): the Starting Capital card and tables have not been compared with a
real game start.** Start 3–4 contrasting empires on Linux (default materialist, hive, machine,
nomads), save on day 1, and compare each capital's districts, zones and buildings with the
card. Nomads come out with no capital building: confirm that in game.

**Open check (2026-11-24): which Ideological Strength level opens each tenet slot and raises its
Intensity.** The game files do not say (engine logic), so `/ideologies` states no mapping. In a 4.6
game: adopt an ideology, and at each strength level (0–250, 250–500, 500–750, 750–1000) note how
many tenets can be codified and each one's Intensity; then write it on the page's "How it works".

After changing the extraction script, regenerate the DB from the sibling repo — the two are only
consistent if you do.

## Checks

`pnpm build` runs `pnpm verify` first (type check, lint, tests), so the container build and the
server's deployment cannot build a tree that fails them. The tests include a **DB smoke test**
(`src/lib/server/db/db.smoke.test.ts`): every loader against the real DB, which fails — it does
not skip — without `STELLARIS_DB`. `.env` supplies it on the desktop (`vite.config.ts`); in the
sandbox pass it, as for `pnpm dev`. A loader that reads a new table or column fails there against
a DB from an older extraction: that is the "release the extraction first" rule, enforced.

**Verify a refactor by comparing two builds' pages:** `git archive <ref>` into `$TMPDIR`, symlink
`node_modules`, `vite build` there (a build, unlike `svelte-check`, works with the symlink), serve
both with the same `APP_VERSION` and `STELLARIS_DB`, and diff every route. Normalise what
`scripts/snapshot.mjs` normalises **plus the build's own `version: "<timestamp>"` stamp**, which
differs between any two builds.
Between builds of different code, also mask the content hashes in `_app/immutable/*.<hash>.js`
/ `.css` and the `__sveltekit_<hash>` global; then collapse whitespace runs to compare a reformat
(prettier-plugin-svelte 4.2, 2026-11-22: all 22 routes identical).

**Open checks (2026-11-15), none of them possible in the sandbox:**

- The podman build with the gate in it (`RUN STELLARIS_DB=… pnpm build` in the `Containerfile`).
- `pnpm test` on the desktop picking `STELLARIS_DB` up from `.env` (`loadEnv` in `vite.config.ts`).
- `pnpm dev`, where the layout data is deliberately not cached.
- The tech popup's "could not load, hover again" state in a browser.

**Open decision (2026-11-15):** `scripts/update-deployment.sh` is started with `sudo` from the
service user's own clone, so that account can change what root runs at the next deploy. Proposed,
not done: a root-owned copy outside the clone. It changes the server layout in `DEPLOY.md`.

## Conventions

- **Game version comes from the `meta` table** (`game_version` / `game_version_raw`, read from the
  game's `launcher-settings.json`), surfaced by `loadGameVersion()` → `+layout.server.ts`. Never
  hardcode a version string.
- DB access stays inside `src/lib/server/db/`; routes consume its functions rather than issuing
  their own SQL.
- **The stores (`empire.svelte.ts`, `settings.svelte.ts`) are module-level `$state`: on the server
  one copy for every visitor.** Write to them only from event handlers and effects, never while a
  component initialises or in a `load`. The layout's game data is likewise read once per server
  process and shared, deep-frozen (`+layout.server.ts`): copy before sorting or changing it.
- **Helpers that compare picks side by side live on "Help me choose"** (`src/routes/help`):
  council seats, branch offices, agendas and edicts — one folded table each, picking from it
  picking for the empire. What a helper shows about one pick goes on that pick's card too (a chip
  with a popup: `CouncilChip`, `BranchOfficeChip`, `UnlockChips`). Page-specific tools (the
  tradition cost calculator, the starting-capital tables) stay on their pages.
- **A pickable card or chip is a `PickCard`** (`src/lib/PickCard.svelte`), never a `<button>`: a
  button may hold only phrasing content and nothing interactive, and the cards carry chips and
  popups. Inside any other `<button>`, use `<span>`s (styled `flex`/`block` as needed).
- **The version in the nav is git-decorated** (`scripts/version.mjs`, injected by Vite as
  `__APP_VERSION__`): plain on a clean `main` or a `v<version>` tag, `-<hash>` elsewhere,
  `-SNAPSHOT` when dirty. The container build passes its own `APP_VERSION` (the image has no
  git), which wins. Read at dev-server start: restart `pnpm dev` after a commit to see it change.
