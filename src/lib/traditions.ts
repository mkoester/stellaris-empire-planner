// Pure helpers for the Tradition Trees and Ascension Perks pages.
import type {
	Agenda,
	AscensionPerk,
	Edict,
	ConditionalModifier,
	Swap,
	Tradition,
	TraditionTree,
	Trigger
} from '$lib/server/db';
import { formatModifierValue, modifierLabel, prettyKey } from '$lib/civics';
import {
	AUTHORITIES,
	FLAGS,
	evaluate,
	leafKeys,
	pickSwap,
	positiveLeaves,
	type Authority,
	type EmpireProfile,
	type ProfileFlag,
	type Tri
} from '$lib/triggers';

// ── Variants ─────────────────────────────────────────────────────────────────
interface Swappable {
	name: string | null;
	description: string | null;
	tooltip: string | null;
	modifiers: ConditionalModifier[];
	swaps: Swap[];
}

export interface Effective {
	name: string | null;
	description: string | null;
	tooltip: string | null;
	modifiers: { mod: ConditionalModifier; state: Tri }[]; // state: does it apply?
	swap: Swap | null; // the variant shown, null = base
	otherSwaps: Swap[]; // variants the profile may still get (trigger unknown)
}

// A tradition or perk as the profile sees it: the chosen swap's name/description/effects
// (or the base), its triggered modifiers that can apply, and the variants still open.
export function effective(item: Swappable, p: EmpireProfile): Effective {
	const swap = pickSwap(item.swaps, p);
	const ownEffects = swap === null || swap.inheritEffects;
	const mods = ownEffects ? item.modifiers : swap.modifiers;
	return {
		name: swap?.name ?? item.name,
		description: swap?.description ?? item.description,
		tooltip: swap === null ? item.tooltip : (swap.tooltip ?? (ownEffects ? item.tooltip : null)),
		modifiers: mods
			.map((mod) => ({ mod, state: evaluate(mod.potential, p) }))
			.filter((m) => m.state !== false),
		swap,
		otherSwaps: item.swaps.filter((s) => s !== swap && evaluate(s.trigger, p) === null)
	};
}

// The tree description for the profile: the first variant that may apply.
export function treeDescription(tree: TraditionTree, p: EmpireProfile): string | null {
	const d = tree.descs.find((x) => evaluate(x.trigger, p) !== false) ?? tree.descs[0];
	return d?.description ?? null;
}

// ── Tree layout ──────────────────────────────────────────────────────────────
// The regular traditions as branches: each root (no prerequisite in the tree) starts a
// column; its rows are the successive levels of traditions that require the row above.
export function treeColumns(traditions: Tradition[]): Tradition[][][] {
	const keys = new Set(traditions.map((t) => t.key));
	const inTree = (t: Tradition) => t.requires.filter((r) => keys.has(r));
	const placed = new Set<string>();
	const columns: Tradition[][][] = [];
	for (const root of traditions.filter((t) => inTree(t).length === 0)) {
		const rows: Tradition[][] = [[root]];
		placed.add(root.key);
		for (;;) {
			const above = new Set(rows[rows.length - 1].map((t) => t.key));
			const next = traditions.filter(
				(t) => !placed.has(t.key) && inTree(t).some((r) => above.has(r))
			);
			if (next.length === 0) break;
			next.forEach((t) => placed.add(t.key));
			rows.push(next);
		}
		columns.push(rows);
	}
	// Anything left (a prerequisite cycle) still shows, as its own column.
	for (const t of traditions) if (!placed.has(t.key)) columns.push([[t]]);
	return columns;
}

// ── Per-tree switcher ────────────────────────────────────────────────────────
export interface Axes {
	authorities: Authority[]; // empty = the tree doesn't branch on authority
	flags: ProfileFlag[];
}

const AUTHORITY_LEAF_SET = new Set([
	'is_gestalt',
	'is_regular_empire',
	'is_hive_empire',
	'is_machine_empire'
]);

function treeTriggers(tree: TraditionTree): (Trigger | null)[] {
	const fromItem = (t: Tradition) => [
		t.possible,
		...t.modifiers.map((m) => m.potential),
		...t.swaps.flatMap((s) => [s.trigger, ...s.modifiers.map((m) => m.potential)])
	];
	return [
		tree.potential,
		...tree.descs.map((d) => d.trigger),
		...[tree.adopt, ...tree.traditions, tree.finish].flatMap(fromItem)
	];
}

// The profile axes a tree actually branches on (its potential, descriptions, swaps and
// triggered modifiers) — what its own switcher offers.
export function profileAxes(tree: TraditionTree): Axes {
	const leaves = new Set(treeTriggers(tree).flatMap(leafKeys));
	return {
		authorities: [...leaves].some((l) => AUTHORITY_LEAF_SET.has(l))
			? AUTHORITIES.map((a) => a.key)
			: [],
		flags: FLAGS.filter((f) => leaves.has(f.leaf)).map((f) => f.key)
	};
}

// Ascension trees are the ones whose potential tests an ascension path
// (has_genetic_ascension, has_cybernetic_ascension, …); no standard tree does.
export function isAscensionTree(tree: TraditionTree): boolean {
	return leafKeys(tree.potential).some((k) => /^has_\w+_ascension$/.test(k));
}

// ── Links between trees and perks ────────────────────────────────────────────
export interface TreeLinks {
	unlockedBy: Record<string, string[]>; // tree key → perks its adoption requires
	unlocksPerks: Record<string, string[]>; // tree key → perks that require finishing it
}

export function treeLinks(trees: TraditionTree[], perks: AscensionPerk[]): TreeLinks {
	const unlockedBy: Record<string, string[]> = {};
	const unlocksPerks: Record<string, string[]> = {};
	for (const tree of trees) {
		unlockedBy[tree.key] = [...new Set(positiveLeaves(tree.adopt.possible, 'has_ascension_perk'))];
		unlocksPerks[tree.key] = perks
			.filter((p) => positiveLeaves(p.possible, 'has_tradition').includes(tree.finish.key))
			.map((p) => p.key);
	}
	return { unlockedBy, unlocksPerks };
}

// ── Cost ─────────────────────────────────────────────────────────────────────
// Unity cost of the next tradition after `taken` (adoption and finisher count too), per the
// defines: [base + (perTradition·n)^exp] · [1 + max(size − sizeBase, 0)·penalty·(1 − sizeEffect)]
// · costSetting. sizeEffect is the "empire size effect" reduction as a fraction (0.2 = −20%).
export function traditionCost(
	taken: number,
	empireSize: number,
	sizeEffect: number,
	costSetting: number,
	d: Record<string, number>
): number {
	const base =
		d.TRADITION_COST_AMOUNTS +
		(d.TRADITION_COST_TRADITION * taken) ** d.TRADITION_COST_TRADITION_EXP;
	const size =
		1 +
		Math.max(empireSize - d.EMPIRE_SIZE_BASE, 0) *
			d.EMPIRE_SIZE_TRADITION_COST_PENALTY *
			(1 - sizeEffect);
	return base * size * costSetting;
}

// ── Search ───────────────────────────────────────────────────────────────────
// Everything searchable about a tradition/perk: names (base and variants), descriptions,
// tooltips and modifier labels.
export function searchText(item: Swappable): string {
	const parts = [item.name, item.description, item.tooltip, ...item.modifiers.map(modifierLabel)];
	for (const s of item.swaps)
		parts.push(s.name, s.description, s.tooltip, ...s.modifiers.map(modifierLabel));
	return parts.filter(Boolean).join('\n').toLowerCase();
}

export function matches(text: string, query: string): boolean {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	return words.every((w) => text.includes(w));
}

// ── Edicts & agendas ─────────────────────────────────────────────────────────
export interface Unlock {
	kind: 'edict' | 'agenda';
	key: string;
	name: string;
	tip: string; // full tooltip text
	state: Tri; // can the profile get it?
}

// The edicts and agendas a tradition/perk unlocks for the profile. Game triggers name a
// swapped tradition by its swap name (has_tradition = tr_domination_drone_network), so
// the swaps' names count as the item too; the unlockable's potential picks the variant.
export function unlocksFor(
	item: { key: string; swaps: Swap[] },
	edicts: Edict[],
	agendas: Agenda[],
	p: EmpireProfile
): Unlock[] {
	const keys = new Set([item.key, ...item.swaps.flatMap((s) => (s.locKey ? [s.locKey] : []))]);
	const out: Unlock[] = [];
	const add = (kind: Unlock['kind'], x: Edict | Agenda, tip: string) => {
		if (!x.unlockedBy.some((k) => keys.has(k))) return;
		const state = evaluate(x.potential, p);
		if (state === false) return;
		const name = x.name ?? x.key;
		// Same-named variants (Research Subsidies + its wilderness twin) share one entry.
		const same = out.find((u) => u.kind === kind && u.name === name);
		if (same) {
			same.tip += `\n\n— or, depending on empire type —\n${tip}`;
			if (same.state !== state) same.state = null;
		} else out.push({ kind, key: x.key, name, tip, state });
	};
	for (const e of edicts) add('edict', e, edictTip(e));
	for (const a of agendas) add('agenda', a, agendaTip(a));
	return out;
}

const modLine = (m: ConditionalModifier) => `${formatModifierValue(m)} ${modifierLabel(m)}`;

export function resourceName(key: string): string {
	return prettyKey(key.replace(/^sr_/, ''));
}

export function durationText(days: number): string {
	if (days < 0) return 'until cancelled';
	return days % 360 === 0 ? `${days / 360} year${days === 360 ? '' : 's'}` : `${days} days`;
}

export function edictTip(e: Edict): string {
	const lines = [`Edict: ${e.name ?? e.key}`];
	const amounts = (r: Record<string, number> | undefined) =>
		Object.entries(r ?? {})
			.map(([res, n]) => `${n} ${resourceName(res)}`)
			.join(', ');
	const cost = [
		e.cost?.cost && `Cost ${amounts(e.cost.cost)}`,
		e.cost?.upkeep && `upkeep ${amounts(e.cost.upkeep)}/month`,
		e.length !== null && `lasts ${durationText(e.length)}`
	].filter(Boolean);
	if (cost.length) lines.push(cost.join(' · '));
	lines.push(...e.modifiers.map(modLine));
	if (e.tooltip) lines.push(e.tooltip);
	if (e.description) lines.push('', e.description);
	return lines.join('\n');
}

export function agendaTip(a: Agenda): string {
	const lines = [`Council agenda: ${a.name ?? a.key}`];
	if (a.cost !== null) lines.push(`Launch at ${a.cost.toLocaleString('en')} agenda progress`);
	if (a.modifiers.length)
		lines.push('While preparing:', ...a.modifiers.map((m) => `  ${modLine(m)}`));
	if (a.effectTooltip) lines.push('On launch:', a.effectTooltip);
	if (a.finishModifiers.length)
		lines.push(
			`After launch${a.finishDays ? ` (${durationText(a.finishDays)})` : ''}:`,
			...a.finishModifiers.map((m) => `  ${modLine(m)}`)
		);
	if (a.description) lines.push('', a.description);
	return lines.join('\n');
}

// Split text into plain parts and mentions of the given names (longest name first), so
// "Unlocks Edict: Map the Stars" can render the name with its tooltip.
export function linkify(text: string, names: string[]): { text: string; index: number | null }[] {
	const order = names
		.map((n, i) => ({ n, i }))
		.filter((x) => x.n)
		.sort((a, b) => b.n.length - a.n.length);
	if (!order.length) return [{ text, index: null }];
	const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(order.map((x) => esc(x.n)).join('|'), 'g');
	const out: { text: string; index: number | null }[] = [];
	let last = 0;
	for (const m of text.matchAll(re)) {
		if (m.index > last) out.push({ text: text.slice(last, m.index), index: null });
		out.push({ text: m[0], index: order.find((x) => x.n === m[0])!.i });
		last = m.index + m[0].length;
	}
	if (last < text.length) out.push({ text: text.slice(last), index: null });
	return out;
}
