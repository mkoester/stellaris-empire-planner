import { loadRepeatableTechs } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	techs: loadRepeatableTechs()
});
