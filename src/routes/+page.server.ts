import { loadTraits } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { traits: loadTraits() };
};
