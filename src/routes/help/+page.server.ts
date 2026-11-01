import {
	loadCivics,
	loadCouncilPositions,
	loadOwnedBuildings,
	loadPickUnlocks
} from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	civics: loadCivics(),
	council: loadCouncilPositions(),
	owned: loadOwnedBuildings(), // branch office buildings and holdings
	unlocks: loadPickUnlocks() // agendas and edicts a civic, origin or authority opens
});
