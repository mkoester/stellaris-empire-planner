// Pure helpers for the Ideologies page: tenets grouped per ethic, a tenet's modifiers lined up
// across its tiers (the "how it grows" view), and which tenets every ideology has a version of.
import type { Ideology, Tenet, TenetModifier, TenetScope, Trigger } from '#lib/server/db/index.ts';
import { matches } from '#lib/traditions.ts';

export const TENET_SCOPE_LABELS: Record<TenetScope, string> = {
	country: 'Empire',
	colony: 'Colonies in reach',
	system: 'Systems in reach',
	pop_group: 'Followers',
	leader: 'Leaders'
};

export const PRIORITY_TIPS: Record<Tenet['priority'], string> = {
	high: 'High priority: always among the tenets offered while its requirement holds.',
	default: '',
	low: 'Low priority: only offered when no other tenet is left to offer.'
};

// One ethic's section: the ideology types that use it (xenophobe has two) and its tenets.
export interface EthicSection {
	ethic: string;
	ideologies: Ideology[];
	tenets: Tenet[];
}

// The ethics in the ideologies' order, each with its types and tenets; tenets with no ethic
// (any ideology) are left out — see anyIdeologyTenets.
export function ethicSections(ideologies: Ideology[], tenets: Tenet[]): EthicSection[] {
	const out = new Map<string, EthicSection>();
	for (const i of ideologies) {
		if (!i.ethic) continue;
		if (!out.has(i.ethic)) out.set(i.ethic, { ethic: i.ethic, ideologies: [], tenets: [] });
		out.get(i.ethic)!.ideologies.push(i);
	}
	for (const t of tenets) for (const e of t.ethics) out.get(e)?.tenets.push(t);
	return [...out.values()];
}

export const anyIdeologyTenets = (tenets: Tenet[]): Tenet[] =>
	tenets.filter((t) => t.ethics.length === 0);

// A tenet's family: its key without the ethic it is written for
// (tenet_strategism_authoritarian → tenet_strategism). Others are their own family.
export function tenetFamily(t: Tenet): string {
	const e = t.ethics.length === 1 ? t.ethics[0].replace(/^ethic_/, '') : null;
	return e && t.key.endsWith(`_${e}`) ? t.key.slice(0, -(e.length + 1)) : t.key;
}

// Families every ethic has a tenet of (Strategism, Propagandism): those are "shared", the
// rest unique to their ethic.
export function sharedFamilies(tenets: Tenet[], ethics: string[]): Set<string> {
	const byFamily = new Map<string, Set<string>>();
	for (const t of tenets) {
		const f = tenetFamily(t);
		if (f === t.key) continue;
		if (!byFamily.has(f)) byFamily.set(f, new Set());
		for (const e of t.ethics) byFamily.get(f)!.add(e);
	}
	return new Set([...byFamily].filter(([, es]) => ethics.every((e) => es.has(e))).map(([f]) => f));
}

// A modifier row across the tiers: the same stat (scope, key, conditions) with its value at
// each tier, null where that tier lacks it.
export interface TierRow {
	mod: TenetModifier; // the first tier's, for label, colour and conditions
	values: (number | null)[];
}

// Rows whose potential rules the chosen empire kind out are left out (gestalt null = any).
export function tierRows(
	t: Tenet,
	gestalt: Kind | null = null
): { tiers: number[]; rows: TierRow[] } {
	const tiers = t.tiers.map((x) => x.tier);
	const rows = new Map<string, TierRow>();
	t.tiers.forEach((tier, i) => {
		for (const m of tier.modifiers) {
			if (!fits(m.potential, gestalt)) continue;
			const id = JSON.stringify([m.scope, m.key, m.potential, m.possible]);
			if (!rows.has(id)) rows.set(id, { mod: m, values: tiers.map(() => null) });
			const row = rows.get(id)!;
			row.values[i] = (row.values[i] ?? 0) + m.value;
		}
	});
	return { tiers, rows: [...rows.values()] };
}

// A tier's effect text, or null where it repeats the one before (shown once, in the first tier
// that has it).
export function tierEffects(t: Tenet): { tier: number; text: string }[] {
	const out: { tier: number; text: string }[] = [];
	let last: string | null = null;
	for (const x of t.tiers) {
		if (x.effect && x.effect !== last) out.push({ tier: x.tier, text: x.effect });
		last = x.effect;
	}
	return out;
}

export const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V'];

// Lowercase search text of a tenet: names (gestalt variants too), texts, modifier labels.
export function tenetSearchText(t: Tenet): string {
	return [
		t.name,
		t.description,
		t.unlockText,
		...t.swaps.map((s) => s.name),
		...t.tiers.flatMap((x) => [x.effect, ...x.modifiers.map((m) => m.label ?? m.key)])
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
}

// ── Filters ──

export type Kind = 'gestalt' | 'regular';

// Whether a trigger asks for a gestalt or a regular empire, or neither (null).
export function gestaltFit(tr: Trigger | null): Kind | null {
	if (!tr) return null;
	if ('leaf' in tr) {
		const yes = tr.value === 'yes';
		if (tr.leaf === 'is_gestalt') return yes ? 'gestalt' : tr.value === 'no' ? 'regular' : null;
		if ((tr.leaf === 'is_hive_empire' || tr.leaf === 'is_machine_empire') && yes) return 'gestalt';
		return null;
	}
	const kinds = tr.args.map(gestaltFit);
	if (tr.op === 'and') return kinds.find((k) => k !== null) ?? null;
	if (tr.op === 'or') return kinds.every((k) => k !== null && k === kinds[0]) ? kinds[0] : null;
	const k = kinds.length === 1 ? kinds[0] : null; // not
	return k === 'gestalt' ? 'regular' : k === 'regular' ? 'gestalt' : null;
}

const fits = (tr: Trigger | null, kind: Kind | null) => {
	const k = kind && gestaltFit(tr);
	return !k || k === kind;
};

export type Badge = 'council' | 'high' | 'every' | 'civic';

export const BADGE_LABELS: Record<Badge, string> = {
	council: 'council seat',
	high: 'high priority',
	every: 'every ideology',
	civic: 'from a civic or origin'
};

export function tenetBadges(t: Tenet, shared: Set<string>): Set<Badge> {
	const out = new Set<Badge>();
	if (t.councilBypass.length) out.add('council');
	if (t.priority === 'high') out.add('high');
	if (shared.has(tenetFamily(t))) out.add('every');
	if (t.sourceCivic) out.add('civic');
	return out;
}

// The scopes a tenet's modifiers apply in.
export const tenetScopes = (t: Tenet): Set<TenetScope> =>
	new Set(t.tiers.flatMap((x) => x.modifiers.map((m) => m.scope)));

// The planned empire as the filters see it: its ethics without "fanatic", civics and origin.
export interface EmpireFit {
	ethics: string[];
	picks: string[]; // civics and origin
}

export const empireFit = (draft: {
	ethics: string[];
	civics: string[];
	origin: string | null;
}): EmpireFit => ({
	ethics: draft.ethics.map((e) => e.replace(/^ethic_fanatic_/, 'ethic_')),
	picks: [...draft.civics, ...(draft.origin ? [draft.origin] : [])]
});

export const empireKind = (fit: EmpireFit): Kind | null =>
	fit.ethics.length === 0
		? null
		: fit.ethics.includes('ethic_gestalt_consciousness')
			? 'gestalt'
			: 'regular';

export interface TenetFilter {
	query: string;
	badges: Set<Badge>; // all must be present
	scopes: Set<TenetScope>; // any
	kind: Kind | null;
	empire: EmpireFit | null; // only tenets this empire can get
}

export function tenetVisible(t: Tenet, f: TenetFilter, shared: Set<string>): boolean {
	if (f.query && !matches(tenetSearchText(t), f.query)) return false;
	const badges = tenetBadges(t, shared);
	if ([...f.badges].some((b) => !badges.has(b))) return false;
	if (f.scopes.size) {
		const scopes = tenetScopes(t);
		if (![...f.scopes].some((s) => scopes.has(s))) return false;
	}
	if (!fits(t.potential, f.kind)) return false;
	if (f.empire) {
		const { ethics, picks } = f.empire;
		if (t.ethics.length && !t.ethics.some((e) => ethics.includes(e))) return false;
		if (t.sourceCivic && !picks.includes(t.sourceCivic)) return false;
	}
	return true;
}
