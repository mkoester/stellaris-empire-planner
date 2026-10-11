import {
	loadBuildingsByUnlock,
	loadCouncilPositions,
	loadCivics,
	loadFederations,
	loadJobSwapsBySource
} from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	civics: loadCivics(),
	jobSwaps: loadJobSwapsBySource(),
	council: loadCouncilPositions(),
	buildings: loadBuildingsByUnlock(),
	federationTypes: loadFederations().federationTypes // "Can / Cannot form" lines
});
