// Parse a Stellaris empire file (user_empire_designs.txt, same format as the
// prescripted empires) into Empire objects, and resolve raw keys to display names.
import type { Empire } from '$lib/server/db';

// ── Clausewitz-ish tokenizer + parser ────────────────────────────────────────
function tokenize(text: string): string[] {
	const tokens: string[] = [];
	let i = 0;
	while (i < text.length) {
		const c = text[i];
		if (c === '#') {
			while (i < text.length && text[i] !== '\n') i++;
		} else if (/\s/.test(c)) {
			i++;
		} else if (c === '{' || c === '}' || c === '=') {
			tokens.push(c);
			i++;
		} else if (c === '"') {
			let j = i + 1;
			while (j < text.length && text[j] !== '"') j++;
			tokens.push(text.slice(i, j + 1));
			i = j + 1;
		} else {
			let j = i;
			while (j < text.length && !/[\s{}=#"]/.test(text[j])) j++;
			tokens.push(text.slice(i, j));
			i = j;
		}
	}
	return tokens;
}

const unquote = (s: string) => (s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s);

type Node = string | Node[] | { [k: string]: Node };

class Parser {
	private pos = 0;
	constructor(private toks: string[]) {}
	private peek() {
		return this.toks[this.pos];
	}
	private next() {
		return this.toks[this.pos++];
	}
	// Parse the body of a block (or the whole file) → object, or array if value-only.
	block(): Node {
		const obj: Record<string, Node> = {};
		const list: string[] = [];
		let isList = false;
		while (this.peek() !== undefined && this.peek() !== '}') {
			const key = this.next();
			if (key === '{') {
				this.block();
				if (this.peek() === '}') this.next();
			} else if (this.peek() === '=') {
				this.next();
				const val = this.value();
				if (key in obj) {
					if (!Array.isArray(obj[key])) obj[key] = [obj[key]] as Node[];
					(obj[key] as Node[]).push(val);
				} else obj[key] = val;
			} else {
				isList = true;
				list.push(unquote(key));
			}
		}
		return isList ? list : obj;
	}
	private value(): Node {
		if (this.peek() === '{') {
			this.next();
			const v = this.block();
			if (this.peek() === '}') this.next();
			return v;
		}
		return unquote(this.next());
	}
}

const asStr = (v: Node | undefined): string | null => (typeof v === 'string' ? v : null);
// One value, or a list of values (the parser may nest one level for repeated keys).
const asList = (v: Node | undefined): string[] => {
	if (typeof v === 'string') return [v];
	if (!Array.isArray(v)) return [];
	const out: string[] = [];
	for (const x of v) {
		if (typeof x === 'string') out.push(x);
		else if (Array.isArray(x)) for (const y of x) if (typeof y === 'string') out.push(y);
	}
	return out;
};

// Parse a whole empire file (one or many empires) into Empire[].
export function parseEmpireFile(text: string): Empire[] {
	const root = new Parser(tokenize(text)).block();
	if (typeof root !== 'object' || Array.isArray(root)) return [];
	const empires: Empire[] = [];
	for (const [rawKey, def] of Object.entries(root)) {
		// The block key may be quoted (user files use the empire name, e.g. "My Empire").
		const key = unquote(rawKey);
		if (typeof def !== 'object' || Array.isArray(def)) continue;
		const sp = def.species;
		if (typeof sp !== 'object' || Array.isArray(sp)) continue; // not an empire design
		let name: Node | undefined = def.name;
		if (name && typeof name === 'object' && !Array.isArray(name)) name = name.key ?? name.name;
		const ruler = def.ruler;
		const rulerName =
			ruler && typeof ruler === 'object' && !Array.isArray(ruler) ? asStr(ruler.name) : null;
		// Optional second founding species (same block shape as `species`).
		const sec = def.secondary_species;
		const sx = sec && typeof sec === 'object' && !Array.isArray(sec) ? sec : null;
		empires.push({
			key,
			name: asStr(name) ?? key,
			adjective: asStr(def.adjective),
			shipPrefix: asStr(def.ship_prefix),
			speciesName: asStr(sp.name),
			speciesPlural: asStr(sp.plural),
			speciesAdjective: asStr(sp.adjective),
			secondaryClass: sx ? asStr(sx.class) : null,
			secondaryPortrait: sx ? asStr(sx.portrait) : null,
			secondaryName: sx ? asStr(sx.name) : null,
			secondaryPlural: sx ? asStr(sx.plural) : null,
			secondaryAdjective: sx ? asStr(sx.adjective) : null,
			secondaryTraits: sx ? asList(sx.trait) : [],
			rulerName,
			planetName: asStr(def.planet_name),
			systemName: asStr(def.system_name),
			speciesClass: asStr(sp.class),
			speciesPortrait: asStr(sp.portrait),
			authority: asStr(def.authority),
			government: asStr(def.government),
			origin: asStr(def.origin),
			planetClass: asStr(def.planet_class),
			graphicalCulture: asStr(def.graphical_culture),
			ethics: asList(def.ethic),
			civics: asList(def.civics),
			traits: asList(sp.trait),
			source: 'file'
		});
	}
	return empires;
}

// ── Empire → file (single empire, the game's empire-design format) ────────────

// The fields serializeEmpire writes. Both the db `Empire` and the planner's draft are
// structurally assignable to this (the draft just lacks `government`).
export interface SerializableEmpire {
	name?: string | null;
	adjective?: string | null;
	shipPrefix?: string | null;
	speciesClass?: string | null;
	speciesPortrait?: string | null;
	speciesName?: string | null;
	speciesPlural?: string | null;
	speciesAdjective?: string | null;
	secondaryClass?: string | null;
	secondaryPortrait?: string | null;
	secondaryName?: string | null;
	secondaryPlural?: string | null;
	secondaryAdjective?: string | null;
	secondaryTraits?: string[];
	rulerName?: string | null;
	authority?: string | null;
	government?: string | null;
	origin?: string | null;
	planetName?: string | null;
	planetClass?: string | null;
	systemName?: string | null;
	graphicalCulture?: string | null;
	ethics?: string[];
	civics?: string[];
	traits?: string[];
}

// Serialize one empire to the game's prescripted/`user_empire_designs.txt` format (one
// empire per file). The block key defaults to the empire name. Only modelled fields are
// written and empty values are omitted; field order follows the game's. This is the
// inverse of parseEmpireFile — serialize → parse round-trips the modelled fields.
export function serializeEmpire(e: SerializableEmpire, key?: string): string {
	const q = (s: string) => `"${s.replace(/"/g, "'")}"`;
	const id = (key ?? e.name ?? 'empire').trim() || 'empire';
	const out: string[] = [`${q(id)} = {`];
	const scalar = (name: string, v?: string | null) => {
		if (v) out.push(`\t${name} = ${q(v)}`);
	};

	scalar('name', e.name);
	scalar('adjective', e.adjective);
	scalar('ship_prefix', e.shipPrefix);

	out.push('\tspecies = {');
	const sp = (name: string, v?: string | null) => {
		if (v) out.push(`\t\t${name} = ${q(v)}`);
	};
	sp('class', e.speciesClass);
	sp('portrait', e.speciesPortrait);
	sp('name', e.speciesName);
	sp('plural', e.speciesPlural);
	sp('adjective', e.speciesAdjective);
	for (const t of e.traits ?? []) out.push(`\t\ttrait = ${q(t)}`);
	out.push('\t}');

	// Second founding species — written only when one has been chosen.
	if (e.secondaryClass || e.secondaryName || (e.secondaryTraits?.length ?? 0) > 0) {
		out.push('\tsecondary_species = {');
		const sx = (name: string, v?: string | null) => {
			if (v) out.push(`\t\t${name} = ${q(v)}`);
		};
		sx('class', e.secondaryClass);
		sx('portrait', e.secondaryPortrait);
		sx('name', e.secondaryName);
		sx('plural', e.secondaryPlural);
		sx('adjective', e.secondaryAdjective);
		for (const t of e.secondaryTraits ?? []) out.push(`\t\ttrait = ${q(t)}`);
		out.push('\t}');
	}

	scalar('authority', e.authority);
	if (e.civics?.length) out.push(`\tcivics = { ${e.civics.map(q).join(' ')} }`);
	scalar('government', e.government);
	scalar('origin', e.origin);
	for (const et of e.ethics ?? []) out.push(`\tethic = ${q(et)}`);
	scalar('planet_name', e.planetName);
	scalar('planet_class', e.planetClass);
	scalar('system_name', e.systemName);
	scalar('graphical_culture', e.graphicalCulture);
	if (e.rulerName) out.push(`\truler = {\n\t\tname = ${q(e.rulerName)}\n\t}`);

	out.push('}', '');
	return out.join('\n');
}

// ── Key → display name ───────────────────────────────────────────────────────
const PREFIXES = [
	'ethic_fanatic_',
	'ethic_',
	'trait_',
	'civic_',
	'auth_',
	'gov_',
	'origin_',
	'pc_'
];

// Resolve a raw key to a display name: prefer the extracted `names` map, else strip a
// known prefix and title-case (trait_strong → "Strong", auth_imperial → "Imperial").
export function keyName(key: string | null, names: Record<string, string>): string {
	if (!key) return '—';
	if (names[key]) return names[key];
	let s = key;
	for (const p of PREFIXES) {
		if (s.startsWith(p)) {
			s = s.slice(p.length);
			break;
		}
	}
	s = s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	return key.startsWith('ethic_fanatic_') ? `Fanatic ${s}` : s;
}

// Ship type from a graphical_culture: the biogenesis appearances are organic bio-ships.
export const shipTypeLabel = (graphicalCulture: string | null): string =>
	graphicalCulture?.startsWith('biogenesis') ? 'Organic (bio-ships)' : 'Regular';
