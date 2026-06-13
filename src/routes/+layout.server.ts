import { loadGameVersion, loadEntityNames, loadLockedCivicKeys } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({
	gameVersion: loadGameVersion(),
	names: loadEntityNames(),
	lockedCivics: loadLockedCivicKeys(),
	// When set, every builder section renders its cards as plain (non-interactive)
	// elements so their text can be selected/copied. See each section's `debug` flag.
	debugDisableSelection: !!env.DEBUG_DISABLE_SELECTION
});
