// Pure, presentation-layer helpers for the /precursors route. Extracted from the
// page component so they can be unit-tested in isolation. No Svelte/runtime state
// here — only data → display logic. Types come in type-only (erased at runtime).
import type {
	Modifier,
	Precursor,
	PrecursorReward,
	PrecursorMegastructure,
	RelicModifier,
	ActiveModifier,
	RelicResource,
	DepositResource,
	PrecursorPlanet,
	PrecursorHomeworldReward
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

// A set of empire types → short human note ("regular / hive", "non-wilderness", …).
// null when it's the full set (effectively unconditional).
export function typesLabel(types: EmpireType[]): string | null {
	if (types.length >= ALL_TYPES.length) return null;
	if (types.length === ALL_TYPES.length - 1) {
		return `non-${ALL_TYPES.find((t) => !types.includes(t))}`;
	}
	return types.join(' / ');
}

// Relic passive condition → short human note. null when it applies to every type.
export function conditionLabel(condition: string | null): string | null {
	return condition ? typesLabel(applicableTypes(condition)) : null;
}

// A relic passive merged across condition branches: same modifier+value collapsed
// into one row whose `types` is the union of the branches' empire types. When that
// union is the full set the passive is effectively unconditional (typesLabel → null).
export interface MergedPassive {
	key: string;
	value: number;
	label: string | null;
	positiveIsGood: boolean;
	types: EmpireType[];
}

// Merge a relic's passive modifiers: dedupe rows that are the *same* modifier+value
// (e.g. the Baol's +10% pop growth granted via a non-machine branch *and* a
// machine/wilderness branch → one unconditional row), unioning their empire types.
export function mergeRelicPassives(passives: RelicModifier[]): MergedPassive[] {
	const byId = new Map<string, MergedPassive>();
	const order: string[] = [];
	for (const p of passives) {
		const id = `${p.key}|${p.value}`;
		if (!byId.has(id)) {
			byId.set(id, {
				key: p.key,
				value: p.value,
				label: p.label,
				positiveIsGood: p.positiveIsGood,
				types: []
			});
			order.push(id);
		}
		const merged = byId.get(id)!;
		const apply = applicableTypes(p.condition);
		merged.types = ALL_TYPES.filter((t) => merged.types.includes(t) || apply.includes(t));
	}
	return order.map((id) => byId.get(id)!);
}

// `_add` modifiers that are really fractional strengths shown as a percentage
// (e.g. the Tempest Invocator's storm repulsion: 1.0 = +100%).
const PERCENT_ADD_MODIFIERS = new Set(['country_storm_repulsion_influence_add']);

// A reward (permanent effect) modifier merged across its empire-type/choice variants.
export interface MergedReward {
	key: string;
	value: number;
	label: string | null;
	positiveIsGood: boolean;
	types: EmpireType[]; // empire types that can get it
	choiceNote: string | null; // when choice-gated within a type, e.g. "research made public"
}

// The player-choice descriptor for a variant (Vultaum: regular empires choose to
// keep the research secret or make it public — only some effects differ).
const VARIANT_CHOICE_LABELS: Record<string, string> = {
	suppressed: 'research kept secret',
	public: 'research made public'
};

// Merge a precursor's reward modifiers across its variants (like mergeRelicPassives,
// but reward variants split by empire type *and* sometimes a choice). Same
// modifier+value collapses into one row whose `types` is the union of the empire
// types of the variants granting it; `choiceNote` is set when, for those types,
// only some (choice) variants grant it — so Vultaum's regular-empire "kept secret"
// vs "made public" options read correctly.
export function mergeRewardModifiers(rewards: PrecursorReward[]): MergedReward[] {
	type Acc = {
		key: string;
		value: number;
		label: string | null;
		positiveIsGood: boolean;
		variants: Set<string>;
	};
	const byId = new Map<string, Acc>();
	const order: string[] = [];
	for (const r of rewards) {
		for (const m of r.modifiers) {
			const id = `${m.key}|${m.value}`;
			if (!byId.has(id)) {
				byId.set(id, {
					key: m.key,
					value: m.value,
					label: m.label,
					positiveIsGood: m.positiveIsGood,
					variants: new Set()
				});
				order.push(id);
			}
			byId.get(id)!.variants.add(r.variant);
		}
	}
	const variantsForType = (t: EmpireType) =>
		rewards.filter((r) => variantApplies(r.variant, t)).map((r) => r.variant);

	return order.map((id) => {
		const e = byId.get(id)!;
		const types = ALL_TYPES.filter((t) => [...e.variants].some((v) => variantApplies(v, t)));
		// choice-gated when, for the applicable types, some variant doesn't grant it
		const applicable = new Set<string>();
		for (const t of types) for (const v of variantsForType(t)) applicable.add(v);
		const choiceGated = [...applicable].some((v) => !e.variants.has(v));
		const choiceNote = choiceGated
			? [...e.variants]
					.map((v) => VARIANT_CHOICE_LABELS[v])
					.filter(Boolean)
					.join(' / ') || null
			: null;
		return {
			key: e.key,
			value: e.value,
			label: e.label,
			positiveIsGood: e.positiveIsGood,
			types,
			choiceNote
		};
	});
}

// The "(…)" qualifier for a merged reward: empire-type note + choice note (null = all).
export function rewardQualifier(m: MergedReward): string | null {
	const parts = [typesLabel(m.types), m.choiceNote].filter((p): p is string => !!p);
	return parts.length ? parts.join(', ') : null;
}

// ── Modifier formatting ────────────────────────────────────────────────────
export function formatValue(mod: Modifier): string {
	const sign = mod.value > 0 ? '+' : '';
	if (mod.key.endsWith('_add') && !PERCENT_ADD_MODIFIERS.has(mod.key)) {
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

// ── Relic triumph (active ability) ─────────────────────────────────────────
const titleCase = (s: string): string =>
	s
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');

// Format a list of relic resources (cost or produces) → "3000 Unity, 2000 Minerals"
// (+ a note if any of them grows with use).
export function relicResourceLabel(resources: RelicResource[]): string {
	if (!resources.length) return '';
	const base = resources.map((r) => `${r.amount} ${titleCase(r.resource)}`).join(', ');
	return resources.some((r) => r.scales) ? `${base} (grows with each use)` : base;
}

// Format one home-world discovery reward. A scaled resource burst reads as
// "120× monthly Unity output (240–9,999)" — the multiplier is applied to the
// empire's current monthly output of that resource, clamped to the range; the
// flat minor-artifacts payout reads as "Minor Artifacts (750–1,500)".
export function homeworldRewardLabel(r: PrecursorHomeworldReward): string {
	const name = titleCase(r.resource.replace(/_research$/, ''));
	const range = `${r.minAmount.toLocaleString('en-US')}–${r.maxAmount.toLocaleString('en-US')}`;
	return r.multiplier === null
		? `${name} (${range})`
		: `${r.multiplier}× monthly ${name} output (${range})`;
}

// The triumph's temporary modifiers, grouped by their (consecutive) `groupLabel`.
// For 'choice' actives each group is a named option (e.g. "Martial Guidance"); for
// 'direct'/'random' actives every group label is null → a single flat group.
export interface ActiveModifierGroup {
	label: string | null;
	modifiers: ActiveModifier[];
}
export function groupActiveModifiers(mods: ActiveModifier[]): ActiveModifierGroup[] {
	const groups: ActiveModifierGroup[] = [];
	for (const m of mods) {
		const last = groups[groups.length - 1];
		if (last && last.label === m.groupLabel) last.modifiers.push(m);
		else groups.push({ label: m.groupLabel, modifiers: [m] });
	}
	return groups;
}

// Triumph cooldown in days → years (Stellaris year = 360 days).
export function cooldownLabel(days: number | null): string | null {
	if (!days) return null;
	const years = +(days / 360).toFixed(1);
	return `${years} ${years === 1 ? 'year' : 'years'}`;
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
