// Pure helpers for the Tradition Trees and Ascension Perks pages.
import type {
	AscensionPerk,
	ConditionalModifier,
	Swap,
	Tradition,
	TraditionTree,
	Trigger
} from '$lib/server/db';
import { modifierLabel } from '$lib/civics';
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
