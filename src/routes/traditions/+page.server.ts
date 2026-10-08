import {
	loadAscensionPerks,
	loadGameDefines,
	loadProfileInputs,
	loadTraditionTrees,
	loadUnlockables
} from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	trees: loadTraditionTrees(),
	perks: loadAscensionPerks(), // for the tree ↔ perk links
	defines: loadGameDefines(),
	...loadProfileInputs(),
	...loadUnlockables() // edicts + agendas for tooltips
});
