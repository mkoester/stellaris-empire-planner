// The single "current empire" the whole app works on — set by importing a predefined
// empire or loading a user_empire_designs.txt. (Phase 1: import + view. Later the
// builder pages will bind to this shared state.)
import type { Empire } from '$lib/server/db';

let current = $state<Empire | null>(null);

export const empire = {
	get current() {
		return current;
	},
	load(e: Empire | null) {
		current = e;
	}
};
