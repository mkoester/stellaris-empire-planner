import { loadRooms } from '#lib/server/db/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	rooms: loadRooms()
});
