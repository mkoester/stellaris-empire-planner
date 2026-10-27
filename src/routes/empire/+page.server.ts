import {
	loadPrescriptedEmpires,
	loadEntityNames,
	loadModifierIndex,
	loadEthics,
	loadCivics,
	loadOrigins,
	loadArchetypes,
	loadHistoryTraitKeys,
	loadProfileInputs,
	loadGameStartScripts,
	loadCapitalNames
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
	historyTraits: loadHistoryTraitKeys(),
	// The starting capital: the game's setup scripts, run client-side by $lib/startCapital.
	...loadProfileInputs(),
	gameStartScripts: loadGameStartScripts(),
	capitalNames: loadCapitalNames()
});
