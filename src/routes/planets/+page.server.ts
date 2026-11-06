import { loadPlanetClasses, loadInitializers } from '#lib/server/db/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	planetClasses: loadPlanetClasses(),
	initializers: loadInitializers()
});
