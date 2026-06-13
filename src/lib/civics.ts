// Presentation-layer helpers for the /civics route. Pure data → display logic so
// they can be unit-tested; types come in type-only.
import type { Civic, CivicRequirement, Modifier } from '$lib/server/db';

export function civicTypeLabel(t: string): string {
	return (
		{ normal: 'Regular', gestalt: 'Gestalt', corporate: 'Corporate', special: 'Special' }[t] ?? t
	);
}

// Group selectable civics by their type (stable display order), alphabetical within.
const TYPE_ORDER = ['normal', 'gestalt', 'corporate', 'special'];
export function groupCivicsByType(
	civics: Civic[]
): { type: string; label: string; items: Civic[] }[] {
	const by = new Map<string, Civic[]>();
	for (const c of civics) {
		if (!by.has(c.civicType)) by.set(c.civicType, []);
		by.get(c.civicType)!.push(c);
	}
	return TYPE_ORDER.filter((t) => by.has(t)).map((t) => ({
		type: t,
		label: civicTypeLabel(t),
		items: by.get(t)!.sort((a, b) => (a.name ?? a.key).localeCompare(b.name ?? b.key))
	}));
}

// Turn a gating key (ethic_/auth_/civic_/origin_) into a readable name, e.g.
// "ethic_fanatic_materialist" → "Fanatic Materialist", "auth_corporate" → "Corporate".
// Only the leading category prefix is stripped — the corporate/machine/hive part of
// a civic key is kept so distinct civics don't collapse to the same name (e.g.
// civic_anglers → "Anglers", civic_corporate_anglers → "Corporate Anglers").
const PREFIXES = ['ethic_fanatic_', 'ethic_', 'auth_', 'civic_', 'origin_'];
export function prettyKey(value: string): string {
	let s = value;
	for (const p of PREFIXES) {
		if (s.startsWith(p)) {
			s = s.slice(p.length);
			break;
		}
	}
	s = s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	if (value.startsWith('ethic_fanatic_')) s = `Fanatic ${s}`;
	return s;
}

// Modifiers stored as a fraction but shown as a percentage. `_mult` (including
// variants like `_mult_uninhabitable`) and `_perc` keys are always percentages; a
// number of `_add`/suffixless families (happiness, habitability, attraction,
// tolerance, exp gain, research/survey speed, chances, cooldowns, market fees and a
// few combat stats) are too — whereas flat amounts (envoys, leader skill, per-job
// resource output, influence, loyalty, trait counts, crime) stay raw. This is the
// ONE place modifier values become percentages; every page (incl. precursors)
// formats through formatModifierValue.
//
// The families are anchored (e.g. `_happiness$`, not bare `happiness`) so flat keys
// that merely contain the word — like `planet_crime_no_happiness_add` (−30 crime) —
// are not mistaken for percentages. `storm_repulsion` is an explicit special case (a
// storm-repulsion "effect" that reads as a %, despite its `_influence_add` key).
function isPercentModifier(key: string): boolean {
	if (key.includes('_mult') || key.endsWith('_perc')) return true;
	return /habitability|_happiness$|_attraction$|_tolerance$|_exp_gain$|research_speed$|survey_speed|_chance_add$|army_health$|weapon_damage$|orbital_bombardment_damage$|_cooldown$|_fee$|storm_repulsion/.test(
		key
	);
}

// Format a modifier value: percentage families show `value × 100`%, everything else
// shows the raw number. Used by the civics/origins pages and the empire Effects block.
export function formatModifierValue(mod: Modifier): string {
	const sign = mod.value > 0 ? '+' : '';
	if (isPercentModifier(mod.key)) {
		const pct = mod.value * 100;
		const n = Number.isInteger(pct) ? pct : parseFloat(pct.toFixed(2));
		return `${sign}${n}%`;
	}
	const n = Number.isInteger(mod.value) ? mod.value : parseFloat(mod.value.toFixed(2));
	return `${sign}${n}`;
}

export function modifierColor(mod: Modifier): string {
	const good = mod.value > 0 === mod.positiveIsGood;
	return good ? 'text-emerald-400' : 'text-red-400';
}

// Order a modifier list for display: alphabetical by label, with the Shroud
// "Add Attunement with …" modifiers (which every civic carries) split off to the
// end so a card's real, distinguishing effects come first. Callers render a divider
// between `main` and `attunement` when both are present.
export function sortModifiers(mods: Modifier[]): { main: Modifier[]; attunement: Modifier[] } {
	const isAttunement = (m: Modifier) => /attunement/.test(m.key);
	const byLabel = (a: Modifier, b: Modifier) => modifierLabel(a).localeCompare(modifierLabel(b));
	return {
		main: mods.filter((m) => !isAttunement(m)).sort(byLabel),
		attunement: mods.filter(isAttunement).sort(byLabel)
	};
}

// Display name for a modifier. The single home for label formatting: strips any
// unresolved game-script tags like [This.GetColor] (defensive — none currently
// survive extraction) and falls back to a title-cased key when the label is missing
// or empty. The fallback drops the trailing value-suffix so an un-localised key reads
// as a name, not a raw key (e.g. envoys_add → "Envoys", planet_crime_mult → "Planet
// Crime"); a handful of modifiers have no game loc at all and rely on this.
export function modifierLabel(mod: Modifier): string {
	const label = mod.label?.replace(/\[.*?\]/g, '').trim();
	if (label) return label;
	const key = mod.key.replace(/_(add|mult)(_uninhabitable)?$/, '');
	return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Collapse a civic's requirements into 'requires' / 'excludes' display lines. An
// OR set (require_any, same groupId) becomes a single "A or B" requires line.
export interface CivicRequirementLine {
	kind: string; // what's gated: ethic / civic / origin / authority / ship_type
	type: 'require' | 'exclude';
	text: string;
}
// The display text for one gated value: ship-type gates read "Organic ships",
// species-archetype gates ("MACHINE") read "Machine", everything else via prettyKey.
function requirementValueText(kind: string, value: string): string {
	if (kind === 'ship_type') return `${prettyKey(value)} ships`;
	if (kind === 'archetype') return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
	return prettyKey(value);
}
export function civicRequirementLines(reqs: CivicRequirement[]): CivicRequirementLine[] {
	const lines: CivicRequirementLine[] = [];
	const anyGroups = new Map<number, { kind: string; vals: string[] }>();
	for (const r of reqs) {
		if (r.operator === 'require_any') {
			if (!anyGroups.has(r.groupId)) anyGroups.set(r.groupId, { kind: r.kind, vals: [] });
			anyGroups.get(r.groupId)!.vals.push(requirementValueText(r.kind, r.value));
		}
	}
	for (const g of anyGroups.values())
		lines.push({ kind: g.kind, type: 'require', text: g.vals.join(' or ') });
	for (const r of reqs) {
		const text = requirementValueText(r.kind, r.value);
		if (r.operator === 'require') lines.push({ kind: r.kind, type: 'require', text });
		else if (r.operator === 'forbid') lines.push({ kind: r.kind, type: 'exclude', text });
	}
	// Drop duplicates (distinct keys can still map to the same display text).
	const seen = new Set<string>();
	const deduped = lines.filter((l) => {
		const id = `${l.type}|${l.text}`;
		if (seen.has(id)) return false;
		seen.add(id);
		return true;
	});
	return deduped.sort(compareRequirementLines);
}

// Display order for requirement chips: grouped by kind (legend order), alphabetical
// within — except ethics, which read Gestalt first, then each axis with the regular
// variant before its Fanatic one ("Egalitarian" before "Fanatic Egalitarian").
const KIND_ORDER = ['ethic', 'civic', 'origin', 'authority', 'archetype', 'ship_type'];
function ethicSortKey(text: string): [number, string, number] {
	if (/^gestalt/i.test(text)) return [0, '', 0]; // Gestalt Consciousness first
	const fanatic = /^fanatic /i.test(text);
	return [1, text.replace(/^fanatic /i, '').toLowerCase(), fanatic ? 1 : 0];
}
function compareRequirementLines(a: CivicRequirementLine, b: CivicRequirementLine): number {
	const rank = (k: string) => {
		const i = KIND_ORDER.indexOf(k);
		return i === -1 ? KIND_ORDER.length : i;
	};
	const ka = rank(a.kind);
	const kb = rank(b.kind);
	if (ka !== kb) return ka - kb;
	if (a.kind === 'ethic') {
		const [ga, na, fa] = ethicSortKey(a.text);
		const [gb, nb, fb] = ethicSortKey(b.text);
		return ga - gb || na.localeCompare(nb) || fa - fb;
	}
	return a.text.localeCompare(b.text);
}

// Colour a requirement chip by what it gates (one hue per kind), with the lighter
// shade for "needs" and a stronger one for "excl." so a kind reads the same whether
// required or forbidden. Full class strings (not built dynamically) so Tailwind
// keeps them.
const REQ_KIND_CLASS: Record<string, { require: string; exclude: string }> = {
	ethic: {
		require: 'bg-amber-500/10 text-amber-300/70',
		exclude: 'bg-amber-500/25 text-amber-200'
	},
	civic: { require: 'bg-sky-500/10 text-sky-300/70', exclude: 'bg-sky-500/25 text-sky-200' },
	origin: {
		require: 'bg-violet-500/10 text-violet-300/70',
		exclude: 'bg-violet-500/25 text-violet-200'
	},
	authority: {
		require: 'bg-rose-500/10 text-rose-300/70',
		exclude: 'bg-rose-500/25 text-rose-200'
	},
	archetype: {
		require: 'bg-lime-500/10 text-lime-300/70',
		exclude: 'bg-lime-500/25 text-lime-200'
	},
	ship_type: { require: 'bg-teal-500/10 text-teal-300/70', exclude: 'bg-teal-500/25 text-teal-200' }
};
const REQ_FALLBACK = {
	require: 'bg-slate-500/10 text-slate-300/70',
	exclude: 'bg-slate-500/25 text-slate-200'
};
export function requirementChipClass(line: CivicRequirementLine): string {
	return (REQ_KIND_CLASS[line.kind] ?? REQ_FALLBACK)[line.type];
}

// The requirement kinds, in display order, for the legend (label per coloured hue).
export const REQUIREMENT_KINDS: { kind: string; label: string }[] = [
	{ kind: 'ethic', label: 'Ethics' },
	{ kind: 'civic', label: 'Civics' },
	{ kind: 'origin', label: 'Origin' },
	{ kind: 'authority', label: 'Government' },
	{ kind: 'ship_type', label: 'Ship type' }
];

// The kinds authorities gate on — for the Government page's legend (ethics + the
// Machine/biological species-archetype split that separates Hive from Machine).
export const AUTHORITY_REQUIREMENT_KINDS: { kind: string; label: string }[] = [
	{ kind: 'ethic', label: 'Ethics' },
	{ kind: 'archetype', label: 'Species type' }
];
