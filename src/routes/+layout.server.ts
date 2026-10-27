import {
	loadGameVersion,
	loadEntityNames,
	loadLockedCivicKeys,
	loadOriginStarts,
	loadTraitCosts,
	loadBaseTraitByClass,
	loadOverviewTooltips,
	loadCompatData,
	loadProfileInputs,
	loadGameStartScripts,
	loadCapitalNames
} from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { version as appVersion } from '../../package.json';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({
	// The container build passes the git-decorated version (scripts/build-container.sh).
	appVersion: env.APP_VERSION || appVersion,
	gameVersion: loadGameVersion(),
	names: loadEntityNames(),
	lockedCivics: loadLockedCivicKeys(),
	originStarts: loadOriginStarts(),
	traitCosts: loadTraitCosts(),
	baseTraitByClass: loadBaseTraitByClass(),
	overviewTooltips: loadOverviewTooltips(),
	// Cross-section eligibility rules, evaluated client-side by $lib/compat.
	compat: loadCompatData(),
	// The starting capital (Empire card, and what each pick adds on the builder pages): the
	// game's setup scripts, run client-side by $lib/startCapital.
	...loadProfileInputs(),
	gameStartScripts: loadGameStartScripts(),
	capitalNames: loadCapitalNames(),
	// When set, every builder section renders its cards as plain (non-interactive)
	// elements so their text can be selected/copied. See each section's `debug` flag.
	debugDisableSelection: !!env.DEBUG_DISABLE_SELECTION
});
