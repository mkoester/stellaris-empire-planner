import {
	loadArchetypes,
	loadTraitCategories,
	loadSpeciesClasses,
	loadTraits,
	loadTraitsForKeys
} from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const archetypes = loadArchetypes();
	const baseTraitKeys = [
		...new Set(
			Object.values(archetypes)
				.map((a) => a.baseTrait)
				.filter((k): k is string => k !== null)
		)
	];
	const baseTraits = Object.fromEntries(loadTraitsForKeys(baseTraitKeys).map((t) => [t.key, t]));

	return {
		traits: loadTraits(),
		archetypes,
		traitCategories: loadTraitCategories(),
		speciesClasses: loadSpeciesClasses(),
		baseTraits
	};
};
