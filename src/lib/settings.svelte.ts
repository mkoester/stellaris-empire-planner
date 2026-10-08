import { ANY_PROFILE, type EmpireProfile } from '$lib/triggers';

// Small global UI preferences shared across pages. Module-level $state is fine here
// (single-user local tool); pages read settings.* and it stays in sync.

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
	}
};
