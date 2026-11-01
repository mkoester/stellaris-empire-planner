import { unlocksByPick } from '$lib/unlocks';
import { loadAuthorities, loadPickUnlocks } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	authorities: loadAuthorities(),
	unlocks: unlocksByPick(loadPickUnlocks()) // agendas and edicts it opens, by "kind:key"
});
