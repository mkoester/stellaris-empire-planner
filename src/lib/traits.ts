// Pure helpers for the Species builder's trait cards.
import type { CompatRule, Trait } from '$lib/server/db';
import { civicRequirementLines, type CivicRequirementLine } from '$lib/civics';

type TraitLike = Pick<Trait, 'key' | 'cost' | 'category' | 'archetypes' | 'modifiers' | 'tags'>;

const isPositive = (t: TraitLike) => t.tags.includes('positive') || (t.cost ?? 0) > 0;

// The better versions of a positive trait in other categories (Intelligent → Cybernetic
// Infinity Sphere, Psionic Cranial Megatrophy): traits that give every one of its
// modifiers in the same direction, at least as strongly, for at most its cost — and are
// strictly better in one of the two (larger effect and/or cheaper). Only traits the
// given archetype can take count, cheapest first. Extra effects of the better version
// don't matter here.
export function betterVersions<T extends TraitLike>(trait: T, all: T[], archetype: string): T[] {
	if (!isPositive(trait) || !trait.modifiers.length || trait.cost == null) return [];
	const cost = trait.cost;
	return all
		.filter((b) => {
			if (b.key === trait.key || b.category === trait.category || b.cost == null) return false;
			if (!b.archetypes.includes(archetype) || !isPositive(b) || b.cost > cost) return false;
			let stronger = false;
			for (const m of trait.modifiers) {
				const bm = b.modifiers.find((x) => x.key === m.key);
				if (!bm || Math.sign(bm.value) !== Math.sign(m.value)) return false;
				if (Math.abs(bm.value) < Math.abs(m.value)) return false;
				if (Math.abs(bm.value) > Math.abs(m.value)) stronger = true;
			}
			return stronger || b.cost < cost;
		})
		.sort((a, b) => a.cost! - b.cost!); // cheapest first
}

// A trait's "needs …" / "excl. …" lines, like a civic card's: its allowed/forbidden
// origins, civics, ethics and homeworlds (the compat rules it owns) plus its opposites.
export function traitRequirementLines(
	trait: Pick<Trait, 'key' | 'opposites'>,
	rules: CompatRule[],
	names: Record<string, string>
): CivicRequirementLine[] {
	return civicRequirementLines(
		[
			...rules.filter((r) => r.ownerKind === 'trait' && r.owner === trait.key),
			...trait.opposites.map((value) => ({
				kind: 'trait',
				operator: 'forbid' as const,
				value,
				groupId: 0
			}))
		],
		names
	);
}
