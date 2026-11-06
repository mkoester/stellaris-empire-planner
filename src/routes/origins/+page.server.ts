import { unlocksByPick } from '#lib/unlocks.ts';
import {
	loadBuildingsByUnlock,
	loadOrigins,
	loadJobSwapsBySource,
	loadPickUnlocks
} from '#lib/server/db/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	origins: loadOrigins(),
	jobSwaps: loadJobSwapsBySource(),
	buildings: loadBuildingsByUnlock(),
	unlocks: unlocksByPick(loadPickUnlocks()) // agendas and edicts it opens, by "kind:key"
});
