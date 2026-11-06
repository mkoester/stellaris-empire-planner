import { loadFlagAssets, loadFlagColors } from '#lib/server/db/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	flagAssets: loadFlagAssets(),
	flagColors: loadFlagColors()
});
