import { loadPlanetClasses, loadInitializers } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	planetClasses: loadPlanetClasses(),
	initializers: loadInitializers()
});
