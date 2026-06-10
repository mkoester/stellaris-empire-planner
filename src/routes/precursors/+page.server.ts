import { loadPrecursors } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	precursors: loadPrecursors()
});
