import { loadEthics, loadFederations } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	ethics: loadEthics(),
	federationTypes: loadFederations().federationTypes // "Can form federation"
});
