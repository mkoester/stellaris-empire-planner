import {
	loadArchetypes,
	loadTraitCategories,
	loadSpeciesClasses,
	loadTraits,
	loadTraitsForKeys
} from '$lib/server/db';
import { env } from '$env/dynamic/private';
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
		baseTraits,
		debugDisableSelection: !!env.DEBUG_DISABLE_SELECTION
	};
};
