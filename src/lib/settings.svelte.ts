// Small global UI preferences shared across pages. Module-level $state is fine here
// (single-user local tool); pages read settings.* and it stays in sync.

// How multi-rule effect descriptions are laid out: one rule per line (default), or
// inline with " | " separators.
let ruleLayout = $state<'inline' | 'lines'>('lines');

export const settings = {
	get ruleLayout() {
		return ruleLayout;
	},
	toggleRuleLayout() {
		ruleLayout = ruleLayout === 'inline' ? 'lines' : 'inline';
	}
};
