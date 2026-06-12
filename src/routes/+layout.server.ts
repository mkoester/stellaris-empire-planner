import { loadGameVersion, loadEntityNames } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({
	gameVersion: loadGameVersion(),
	names: loadEntityNames()
});
