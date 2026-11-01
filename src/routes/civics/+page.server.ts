import {
	loadBuildingsByUnlock,
	loadCouncilPositions,
	loadCivics,
	loadFederations,
	loadJobSwapsBySource,
	loadOwnedBuildings
} from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	civics: loadCivics(),
	jobSwaps: loadJobSwapsBySource(),
	council: loadCouncilPositions(),
	buildings: loadBuildingsByUnlock(),
	owned: loadOwnedBuildings(), // branch office buildings and holdings
	federationTypes: loadFederations().federationTypes // "Can / Cannot form" lines
});
