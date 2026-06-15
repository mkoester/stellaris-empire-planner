import {
	loadGameVersion,
	loadEntityNames,
	loadLockedCivicKeys,
	loadOriginStarts,
	loadTraitCosts,
	loadBaseTraitByClass,
	loadOverviewTooltips
} from '$lib/server/db';
import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({
	gameVersion: loadGameVersion(),
	names: loadEntityNames(),
	lockedCivics: loadLockedCivicKeys(),
	originStarts: loadOriginStarts(),
	traitCosts: loadTraitCosts(),
	baseTraitByClass: loadBaseTraitByClass(),
	overviewTooltips: loadOverviewTooltips(),
	// When set, every builder section renders its cards as plain (non-interactive)
	// elements so their text can be selected/copied. See each section's `debug` flag.
	debugDisableSelection: !!env.DEBUG_DISABLE_SELECTION
});
