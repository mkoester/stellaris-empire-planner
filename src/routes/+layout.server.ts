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
	loadCapitalNames,
	loadCapitalBuildings
} from '#lib/server/db/index.ts';
import { deepFreeze, once } from '#lib/once.ts';
import { dev } from '$app/env';
import { APP_VERSION, DEBUG_DISABLE_SELECTION } from '$app/env/private';
import type { LayoutServerLoad } from './$types';

// What every page gets from the game DB.
const loadGameData = () => ({
	gameVersion: loadGameVersion(),
	names: loadEntityNames(),
	lockedCivics: loadLockedCivicKeys(),
	originStarts: loadOriginStarts(),
	traitCosts: loadTraitCosts(),
	baseTraitByClass: loadBaseTraitByClass(),
	overviewTooltips: loadOverviewTooltips(),
	// Cross-section eligibility rules, evaluated client-side by #lib/compat.
	compat: loadCompatData(),
	// The starting capital (Empire card, and what each pick adds on the builder pages): the
	// game's setup scripts, run client-side by #lib/startCapital.
	...loadProfileInputs(),
	gameStartScripts: loadGameStartScripts(),
	capitalNames: loadCapitalNames(),
	capitalBuildings: loadCapitalBuildings() // their numbers, for the building popups
});

// The server opens the DB read-only and nothing rewrites it under a running server, so it is
// read once and every request shares the result — frozen, so a render that wrote to it would
// throw rather than change the next visitor's page. Not in dev: there the DB is regenerated
// while `pnpm dev` runs.
const gameData = dev ? loadGameData : once(() => deepFreeze(loadGameData()));

export const load: LayoutServerLoad = () => ({
	// git-decorated: by the container build (scripts/build-container.sh), else at dev/build time
	// (scripts/version.mjs)
	appVersion: APP_VERSION || __APP_VERSION__,
	...gameData(),
	// When set, every builder section renders its cards as plain (non-interactive)
	// elements so their text can be selected/copied. See each section's `debug` flag.
	debugDisableSelection: !!DEBUG_DISABLE_SELECTION
});
