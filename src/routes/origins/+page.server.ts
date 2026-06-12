import { loadOrigins } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	origins: loadOrigins()
});
