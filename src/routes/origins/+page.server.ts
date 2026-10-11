import { loadBuildingsByUnlock, loadOrigins, loadJobSwapsBySource } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	origins: loadOrigins(),
	jobSwaps: loadJobSwapsBySource(),
	buildings: loadBuildingsByUnlock()
});
