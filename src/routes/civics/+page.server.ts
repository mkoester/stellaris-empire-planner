import { loadCivics, loadFederations, loadJobSwapsBySource } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	civics: loadCivics(),
	jobSwaps: loadJobSwapsBySource(),
	federationTypes: loadFederations().federationTypes // "Can / Cannot form" lines
});
