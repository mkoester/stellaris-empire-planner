import { ANY_PROFILE, type EmpireProfile } from '#lib/triggers.ts';

// Small global UI preferences shared across pages; pages read settings.* and it stays in sync.
// Module-level $state: one copy per browser tab, but on the server ONE copy for every visitor.
// So it is only ever written from event handlers and effects, which do not run during SSR — a
// write while a component initialises or in a `load` would show one visitor's choice to the next.

// How multi-rule effect descriptions are laid out: one rule per line (default), or
// inline with " | " separators.
let ruleLayout = $state<'inline' | 'lines'>('lines');

// Whether the civics/origins cards show their "excl." (exclusion) requirement badges.
// "needs" badges always show; exclusions are hidden by default to reduce clutter.
let showExclusions = $state(false);

// The empire-type filter shared by the Tradition Trees and Ascension Perks pages
// (ANY_PROFILE = no filter), and whether items it rules out stay visible (greyed).
let empireProfile = $state<EmpireProfile>(ANY_PROFILE);
let showUnavailable = $state(false);
// Tradition Trees layout: every tradition's details inline ('full'), or names only ('compact').
let traditionView = $state<'full' | 'compact'>('full');

export const settings = {
	get ruleLayout() {
		return ruleLayout;
	},
	toggleRuleLayout() {
		ruleLayout = ruleLayout === 'inline' ? 'lines' : 'inline';
	},
	get showExclusions() {
		return showExclusions;
	},
	toggleExclusions() {
		showExclusions = !showExclusions;
	},
	get empireProfile() {
		return empireProfile;
	},
	set empireProfile(p: EmpireProfile) {
		empireProfile = p;
	},
	get showUnavailable() {
		return showUnavailable;
	},
	toggleShowUnavailable() {
		showUnavailable = !showUnavailable;
	},
	get traditionView() {
		return traditionView;
	},
	toggleTraditionView() {
		traditionView = traditionView === 'full' ? 'compact' : 'full';
	}
};
