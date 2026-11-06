import { loadFallenEmpireTechs } from '#lib/server/db/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	techs: loadFallenEmpireTechs()
});
