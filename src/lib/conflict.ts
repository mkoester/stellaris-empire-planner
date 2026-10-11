// The one look for a builder option that clashes with the rest of the empire (see
// $lib/compat, $lib/limits): greyed out while unpicked — it stays clickable, hover brings
// it back to readable — and a red ring once picked anyway. Never `disabled`.
export const conflictClass = (reasons: string[], selected: boolean): string =>
	!reasons.length
		? ''
		: selected
			? 'ring-2 ring-red-500/70 ring-inset'
			: 'opacity-40 grayscale hover:opacity-80 hover:grayscale-0';

// The transparent look every builder option card shares (Civics, Origins, …): a thin
// border, tinted when picked. Pair it with `border` and a rounding class.
export const pickClass = (selected: boolean): string =>
	selected
		? 'border-primary-500 bg-primary-500/10'
		: 'border-surface-400-500/30 hover:border-surface-400-500/60';
