import {
	loadArchetypes,
	loadTraitCategories,
	loadSpeciesClasses,
	loadTraits,
	loadTraitsForKeys,
	loadCompatData
} from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const archetypes = loadArchetypes();
	const speciesClasses = loadSpeciesClasses();
	// Base-trait objects for every base trait referenced by an archetype OR a species class
	// (e.g. trait_infernal for INF/Thermophile, which no archetype maps to).
	const baseTraitKeys = [
		...new Set(
			[
				...Object.values(archetypes).map((a) => a.baseTrait),
				...speciesClasses.map((c) => c.baseTrait)
			].filter((k): k is string => k != null)
		)
	];
	const baseTraits = Object.fromEntries(loadTraitsForKeys(baseTraitKeys).map((t) => [t.key, t]));
	// Trait objects for the traits civics/origins grant (Tankbound, Necrophage, …): mostly
	// non-initial, so loadTraits() doesn't carry them; the builder shows them as fixed cards.
	const grantedKeys = [...new Set(Object.values(loadCompatData().grantedTraits).flat())];
	const grantedTraitInfo = Object.fromEntries(
		loadTraitsForKeys(grantedKeys).map((t) => [t.key, t])
	);

	return {
		traits: loadTraits(),
		archetypes,
		traitCategories: loadTraitCategories(),
		speciesClasses,
		baseTraits,
		grantedTraitInfo
	};
};
