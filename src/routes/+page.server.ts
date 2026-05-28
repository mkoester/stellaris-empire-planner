import { loadArchetypes, loadTraitCategories, loadSpeciesClasses, loadTraits } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	traits: loadTraits(),
	archetypes: loadArchetypes(),
	traitCategories: loadTraitCategories(),
	speciesClasses: loadSpeciesClasses()
});
