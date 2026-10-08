import {
	loadAscensionPerks,
	loadGameDefines,
	loadProfileInputs,
	loadTraditionTrees
} from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	perks: loadAscensionPerks(),
	trees: loadTraditionTrees(), // for the tree ↔ perk links and tradition names
	defines: loadGameDefines(),
	...loadProfileInputs()
});
