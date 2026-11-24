import { loadBuildings, loadGameDefines, loadIdeologies } from '#lib/server/db/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const ideology = loadIdeologies();
	const keys = new Set(ideology.ideologyBuildings.map((b) => b.key));
	return {
		...ideology,
		defines: loadGameDefines(),
		// the ideological buildings' numbers, for their popups
		buildings: loadBuildings().filter((b) => keys.has(b.key))
	};
};
