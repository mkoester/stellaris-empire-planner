// Small global UI preferences shared across pages. Module-level $state is fine here
// (single-user local tool); pages read settings.* and it stays in sync.

// How multi-rule effect descriptions are laid out: inline with " | " separators, or
// one rule per line.
let ruleLayout = $state<'inline' | 'lines'>('inline');

export const settings = {
	get ruleLayout() {
		return ruleLayout;
	},
	toggleRuleLayout() {
		ruleLayout = ruleLayout === 'inline' ? 'lines' : 'inline';
	}
};
