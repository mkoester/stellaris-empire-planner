import { unlocksByPick } from '#lib/unlocks.ts';
import {
	loadBuildingsByUnlock,
	loadCouncilPositions,
	loadCivics,
	loadFederations,
	loadJobSwapsBySource,
	loadOwnedBuildings,
	loadPickUnlocks
} from '#lib/server/db/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	civics: loadCivics(),
	jobSwaps: loadJobSwapsBySource(),
	council: loadCouncilPositions(),
	buildings: loadBuildingsByUnlock(),
	owned: loadOwnedBuildings(), // branch office buildings and holdings
	federationTypes: loadFederations().federationTypes, // "Can / Cannot form" lines
	unlocks: unlocksByPick(loadPickUnlocks()) // agendas and edicts it opens, by "kind:key"
});
