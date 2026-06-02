import { loadEthics } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	ethics: loadEthics()
});
