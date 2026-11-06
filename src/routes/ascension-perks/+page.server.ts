import {
	loadAscensionPerks,
	loadFederations,
	loadGameDefines,
	loadProfileInputs,
	loadTraditionTrees,
	loadUnlockables
} from '#lib/server/db/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	perks: loadAscensionPerks(),
	trees: loadTraditionTrees(), // for the tree ↔ perk links and tradition names
	defines: loadGameDefines(),
	...loadProfileInputs(),
	...loadUnlockables(), // edicts + agendas for tooltips
	federationTypes: loadFederations().federationTypes // linked from the finishers
});
