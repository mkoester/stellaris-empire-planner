import { loadArchetypes, loadTraitCategories, loadSpeciesClasses, loadTraits } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	traits: loadTraits(),
	archetypes: loadArchetypes(),
	traitCategories: loadTraitCategories(),
	speciesClasses: loadSpeciesClasses(),
	debugDisableSelection: !!env.DEBUG_DISABLE_SELECTION
});
