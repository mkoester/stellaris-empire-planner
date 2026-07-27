// Shared modifier row shapes used across domains.

export interface Modifier {
	key: string;
	value: number;
	label: string | null;
	positiveIsGood: boolean;
}

// A modifier that scales with a count, e.g. Familial: +0.1% Happiness per 100 Familial pops
// (max +20%), or Genetic Memory: +0.5% Habitability per year of colony age (max +25%).
// rate/cap are values (formatted via the normal modifier rules); unit is the "per X" label.
export interface ScalingModifier {
	key: string; // modifier key, e.g. "pop_happiness"
	rate: number; // value per one display unit
	cap: number | null; // value at the scaling value's maximum; null when uncapped (Invasive)
	unit: string; // the "per X" unit, e.g. "100 Familial pops", "negative trait"
	label: string | null;
	positiveIsGood: boolean;
}
