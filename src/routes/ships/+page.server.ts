import { loadOrigins, loadCivics } from '#lib/server/db/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	origins: loadOrigins(),
	civics: loadCivics()
});
