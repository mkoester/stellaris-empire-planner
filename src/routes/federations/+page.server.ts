import { loadFederations, loadProfileInputs, loadTraditionTrees } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	// The tradition trees whose finisher (or its swap, which game triggers name) unlocks
	// a federation type: key → tree, for the "Unlocked by" links and requirement names.
	const finishers: Record<string, { tree: string; name: string }> = {};
	for (const t of loadTraditionTrees()) {
		const entry = { tree: t.key, name: t.name ?? t.key };
		finishers[t.finish.key] = entry;
		for (const s of t.finish.swaps) if (s.locKey) finishers[s.locKey] = entry;
	}
	return { ...loadFederations(), ...loadProfileInputs(), finishers };
};
