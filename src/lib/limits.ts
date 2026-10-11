// A section's own limits — ethic points and axes, trait picks, points and opposites —
// as conflicts, so the builder lets you pick past them and flags the result instead
// (the cross-section rules are $lib/compat). Each check takes one section's picks and
// returns what they break; `addedBy` turns that into the reasons for one option.
import type { Conflict, NameFn } from '$lib/compat';
import { ETHIC_AXES, ETHIC_BUDGET } from '$lib/ethics';

export interface EthicInfo {
	key: string;
	cost: number;
	regular_variant: string | null;
}

// The axis an ethic sits on (fanatic forms share their regular's), or undefined (Gestalt).
const axisOf = (key: string, byKey: Map<string, EthicInfo>) =>
	ETHIC_AXES.find((axis) => axis.includes(byKey.get(key)?.regular_variant ?? key));

export function ethicLimits(picked: string[], ethics: EthicInfo[], name: NameFn): Conflict[] {
	const byKey = new Map(ethics.map((e) => [e.key, e]));
	const out: Conflict[] = [];
	const used = picked.reduce((sum, k) => sum + (byKey.get(k)?.cost ?? 0), 0);
	if (used > ETHIC_BUDGET)
		out.push({
			id: `ethics|points|${used}`,
			text: `Ethics cost ${used} of ${ETHIC_BUDGET} points`
		});
	for (const axis of ETHIC_AXES) {
		const onAxis = picked.filter((k) => axisOf(k, byKey) === axis);
		if (onAxis.length > 1)
			out.push({
				id: `ethics|axis|${[...onAxis].sort().join('|')}`,
				text: `${onAxis.map(name).join(' and ')} share an ethic axis`
			});
	}
	return out;
}

// Picking an ethic replaces whatever was picked on its axis (Xenophile → Fanatic
// Xenophile or → Xenophobe): the last click wins. Off-axis ethics are just added.
export function withEthic(picked: string[], key: string, ethics: EthicInfo[]): string[] {
	const byKey = new Map(ethics.map((e) => [e.key, e]));
	const axis = axisOf(key, byKey);
	return [...picked.filter((k) => k !== key && (!axis || axisOf(k, byKey) !== axis)), key];
}

export interface TraitBudget {
	maxTraits: number;
	maxPoints: number;
}

export interface TraitInfo {
	costs: Record<string, number>;
	opposites: Record<string, string[]>; // as declared (one direction is enough)
	uncounted: Set<string>; // history traits: outside the pick count
}

// `budget` null = the species' archetype isn't known yet, so only opposites are checked.
export function traitLimits(
	picked: string[],
	budget: TraitBudget | null,
	info: TraitInfo,
	name: NameFn
): Conflict[] {
	const out: Conflict[] = [];
	if (budget) {
		const count = picked.filter((k) => !info.uncounted.has(k)).length;
		if (count > budget.maxTraits)
			out.push({
				id: `traits|count|${count}`,
				text: `${count} traits picked, ${budget.maxTraits} allowed`
			});
		const points = picked.reduce((sum, k) => sum + (info.costs[k] ?? 0), 0);
		if (points > budget.maxPoints)
			out.push({
				id: `traits|points|${points}`,
				text: `Traits cost ${points} of ${budget.maxPoints} points`
			});
	}
	picked.forEach((a, i) => {
		for (const b of picked.slice(i + 1))
			if (areOpposites(a, b, info.opposites))
				out.push({
					id: `traits|opposite|${[a, b].sort().join('|')}`,
					text: `${name(a)} and ${name(b)} are opposites`
				});
	});
	return out;
}

// Opposites are declared one way only for many traits, so check both directions.
const areOpposites = (a: string, b: string, opposites: Record<string, string[]>) =>
	(opposites[a] ?? []).includes(b) || (opposites[b] ?? []).includes(a);

// Picking a trait replaces its picked opposites (Strong → Very Strong or → Weak): the
// last click wins.
export function withTrait(
	picked: string[],
	key: string,
	opposites: Record<string, string[]>
): string[] {
	return [...picked.filter((k) => k !== key && !areOpposites(k, key, opposites)), key];
}

// What picking `key` adds to a section's conflicts (empty = fine). Works for options
// already picked too, by comparing the picks without it against the picks with it. The
// count/points ids carry the total, so a pick that worsens an overrun still counts.
export function addedBy(
	check: (picked: string[]) => Conflict[],
	picked: string[],
	key: string
): string[] {
	const without = picked.filter((k) => k !== key);
	const before = new Set(check(without).map((c) => c.id));
	return check([...without, key])
		.filter((c) => !before.has(c.id))
		.map((c) => c.text);
}
