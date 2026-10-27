import {
	loadPrescriptedEmpires,
	loadEntityNames,
	loadModifierIndex,
	loadEthics,
	loadCivics,
	loadOrigins,
	loadArchetypes,
	loadHistoryTraitKeys
} from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	predefined: loadPrescriptedEmpires(),
	names: loadEntityNames(),
	modifierIndex: loadModifierIndex(),
	ethics: loadEthics(),
	civics: loadCivics(),
	origins: loadOrigins(),
	// Trait-pick / point budgets, checked like the Species page does (see $lib/limits).
	archetypes: loadArchetypes(),
	historyTraits: loadHistoryTraitKeys()
});
