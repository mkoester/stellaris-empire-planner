import { loadOrigins, loadCivics } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	origins: loadOrigins(),
	civics: loadCivics()
});
