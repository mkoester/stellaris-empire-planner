// Pure, presentation-layer helpers for the /precursors route. Extracted from the
// page component so they can be unit-tested in isolation. No Svelte/runtime state
// here — only data → display logic. Types come in type-only (erased at runtime).
import type {
	Modifier,
	Precursor,
	PrecursorReward,
	PrecursorMegastructure,
	DepositResource,
	PrecursorPlanet
} from '$lib/server/db';

// ── Grouping / ordering ──────────────────────────────────────────────────────
export interface PrecursorGroup {
	dlc: string | null;
	label: string;
	items: Precursor[];
}

// Group precursors by DLC (base game first, then DLCs in first-appearance order)
// and sort each group's precursors alphabetically by name, for a deterministic
// display order.
export function groupByDlc(precursors: Precursor[]): PrecursorGroup[] {
	const order: (string | null)[] = [];
	const byDlc = new Map<string | null, Precursor[]>();
	for (const p of precursors) {
		if (!byDlc.has(p.requiredDlc)) {
			byDlc.set(p.requiredDlc, []);
			order.push(p.requiredDlc);
		}
		byDlc.get(p.requiredDlc)!.push(p);
	}
	return order.map((dlc) => ({
		dlc,
		label: dlc ?? 'Base game',
		items: byDlc
			.get(dlc)!
			.slice()
			.sort((a, b) => (a.name ?? a.key).localeCompare(b.name ?? b.key))
	}));
}

// ── Empire types ───────────────────────────────────────────────────────────
export type EmpireType = 'regular' | 'machine' | 'hive' | 'wilderness';

export const EMPIRE_TYPES: { key: EmpireType; label: string }[] = [
	{ key: 'regular', label: 'Regular' },
	{ key: 'machine', label: 'Machine' },
	{ key: 'hive', label: 'Hive' },
	{ key: 'wilderness', label: 'Wilderness' }
];

export const ALL_TYPES: EmpireType[] = EMPIRE_TYPES.map((e) => e.key);

// The empire-type flags the relic `potential` conditions test against. (Hive reads
// the same as Regular here — these relics only branch on machine/wilderness.)
export const EMPIRE_FLAGS: Record<EmpireType, Record<string, boolean>> = {
	regular: { is_machine_empire: false, is_wilderness_empire: false },
	machine: { is_machine_empire: true, is_wilderness_empire: false },
	hive: { is_machine_empire: false, is_wilderness_empire: false },
	wilderness: { is_machine_empire: false, is_wilderness_empire: true }
};

// Evaluate one "is_X_empire = yes|no" clause against an empire type.
export function clauseMatches(clause: string, type: EmpireType): boolean {
	const m = clause.match(/(is_\w+)\s*=\s*(yes|no)/);
	if (!m) return true; // unknown clause → don't exclude
	const [, varName, expected] = m;
	const actual = EMPIRE_FLAGS[type][varName] ?? false;
	return (expected === 'yes') === actual;
}

// Condition format from extraction: AND clauses comma-separated; an OR group is
// parenthesised, e.g. "(is_machine_empire = yes OR is_wilderness_empire = yes)".
export function conditionApplies(condition: string | null, type: EmpireType): boolean {
	if (!condition) return true; // no potential → always applies
	return condition.split(/,\s*/).every((clause) => {
		const orGroup = clause.match(/^\((.*)\)$/);
		if (orGroup) return orGroup[1].split(/\s+OR\s+/).some((o) => clauseMatches(o, type));
		return clauseMatches(clause, type);
	});
}

// Which empire types a reward variant applies to (Vultaum splits by type/choice).
export function variantApplies(variant: string, type: EmpireType): boolean {
	switch (variant) {
		case 'default':
			return true; // single reward → applies to everyone
		case 'suppressed':
		case 'public':
			return type === 'regular' || type === 'wilderness';
		case 'machine':
			return type === 'machine';
		case 'hive':
			return type === 'hive';
		case 'hive_machine':
			return type === 'hive' || type === 'machine';
		default:
			return true;
	}
}

// The empire types a relic-passive condition applies to.
export function applicableTypes(condition: string | null): EmpireType[] {
	return ALL_TYPES.filter((t) => conditionApplies(condition, t));
}

// Relic passive condition → short human note ("regular / hive", "non-wilderness",
// …). null when it applies to every type.
export function conditionLabel(condition: string | null): string | null {
	if (!condition) return null;
	const apply = applicableTypes(condition);
	if (apply.length >= ALL_TYPES.length) return null;
	if (apply.length === ALL_TYPES.length - 1) {
		return `non-${ALL_TYPES.find((t) => !apply.includes(t))}`;
	}
	return apply.join(' / ');
}

// ── Modifier formatting ────────────────────────────────────────────────────
export function formatValue(mod: Modifier): string {
	const sign = mod.value > 0 ? '+' : '';
	if (mod.key.endsWith('_add')) {
		const n = Number.isInteger(mod.value) ? mod.value : parseFloat(mod.value.toFixed(2));
		return `${sign}${n}`;
	}
	return `${sign}${Math.round(mod.value * 100)}%`;
}

export function valueColor(mod: Modifier): string {
	return mod.value > 0 === mod.positiveIsGood ? 'text-emerald-400' : 'text-red-400';
}

export function modLabel(mod: Modifier): string {
	if (!mod.label) {
		return mod.key
			.split('_')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}
	return mod.label.replace(/\[.*?\]/g, '').trim() || mod.key;
}

// ── Reward variant labels ──────────────────────────────────────────────────
// Vultaum's variants share the same loc name ("Secrets of the Vultaum"), so we
// distinguish by empire type / choice. Only one variant is ever active.
export const VARIANT_LABELS: Record<string, string> = {
	default: 'Regular empire',
	suppressed: 'Regular empire — research kept secret',
	public: 'Regular empire — research made public',
	machine: 'Machine empire',
	hive: 'Hive mind',
	hive_machine: 'Hive mind / Machine empire'
};

export function variantLabel(r: PrecursorReward): string {
	return VARIANT_LABELS[r.variant] ?? r.name ?? r.variant;
}

// ── Deposits / planets ─────────────────────────────────────────────────────
export function resourceLabel(res: DepositResource): string {
	const name = res.resource
		.replace(/_research$/, '')
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
	const sign = res.kind === 'produces' ? '+' : '';
	return `${sign}${res.amount} ${name}`;
}

// Render-worthy planets: skip bare stars (no label/size/deposits/modifiers).
export function shownPlanets(planets: PrecursorPlanet[]): PrecursorPlanet[] {
	return planets.filter(
		(p) =>
			p.planetClass !== 'star' &&
			(p.planetClassLabel || p.size != null || p.deposits.length > 0 || p.modifiers.length > 0)
	);
}

// Planet classes worth showing at a glance: habitable/colonizable worlds, the
// special precursor worlds, and ringworld sections.
export const RELEVANT_CLASSES = new Set([
	'pc_desert',
	'pc_arid',
	'pc_savannah',
	'pc_tropical',
	'pc_continental',
	'pc_ocean',
	'pc_tundra',
	'pc_arctic',
	'pc_alpine',
	'pc_gaia',
	'pc_hive',
	'pc_machine',
	'pc_city',
	'pc_habitat',
	'pc_ringworld_habitable',
	'pc_cybrex',
	'pc_relic',
	'pc_nuked',
	'pc_broken'
]);

// Not habitable as-is, but terraformable into a colony (e.g. Toxic via Toxoid AP).
export const TERRAFORM_CANDIDATE = new Set(['pc_toxic']);

// Shown by default: homeworlds, anything with a resource deposit or a modifier,
// habitable worlds, terraform candidates. The rest goes behind "show more".
export function isRelevant(p: PrecursorPlanet): boolean {
	return (
		p.isHomeworld ||
		p.deposits.some((d) => !d.isBlocker) ||
		p.modifiers.length > 0 ||
		RELEVANT_CLASSES.has(p.planetClass ?? '') ||
		TERRAFORM_CANDIDATE.has(p.planetClass ?? '')
	);
}

export const isTerraformable = (p: PrecursorPlanet): boolean =>
	TERRAFORM_CANDIDATE.has(p.planetClass ?? '');

export interface DepositChips {
	resources: string[];
	others: string[];
	blockers: { name: string; count: number }[];
}

// Group a planet's deposits for compact display: resource yields individually,
// blockers collapsed by name with a ×count.
export function depositChips(deposits: PrecursorPlanet['deposits']): DepositChips {
	const resources: string[] = [];
	const blockers = new Map<string, number>();
	const others: string[] = [];
	for (const d of deposits) {
		if (d.isBlocker) {
			const name = d.name ?? d.depositKey;
			blockers.set(name, (blockers.get(name) ?? 0) + 1);
		} else if (d.resources.length) {
			for (const r of d.resources) resources.push(resourceLabel(r));
		} else {
			others.push(d.name ?? d.depositKey);
		}
	}
	return {
		resources,
		others,
		blockers: [...blockers].map(([name, count]) => ({ name, count }))
	};
}

// Megastructure chip label, with a ×N count when there is more than one of a type
// (e.g. the Cybrex ruined ring world's four sections → "Ruined Ring Section ×4").
export function megaLabel(ms: PrecursorMegastructure): string {
	const name = ms.label ?? ms.type;
	return ms.count > 1 ? `${name} ×${ms.count}` : name;
}

// ── Misc ───────────────────────────────────────────────────────────────────
export function dlcBadge(dlc: string | null): string {
	if (dlc === null) return 'border-surface-400-500/40 opacity-50';
	return dlc.includes('Ancient')
		? 'border-amber-500/50 text-amber-300'
		: 'border-sky-500/50 text-sky-300';
}
