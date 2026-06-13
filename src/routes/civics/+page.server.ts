import { loadCivics, loadJobSwapsBySource } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	civics: loadCivics(),
	jobSwaps: loadJobSwapsBySource()
});
