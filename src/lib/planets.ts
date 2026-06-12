// Presentation helpers for the /planets reference. Pure data → display logic.
import type { PlanetClass } from '$lib/server/db';

export interface PlanetGroup {
	label: string;
	note: string | null;
	items: PlanetClass[];
}

// Group planet classes for display: the three standard climate families (which
// determine habitability), then special/engineered colonizable worlds, then the
// uninhabitable system bodies.
export function groupPlanetClasses(classes: PlanetClass[]): PlanetGroup[] {
	const wet: PlanetClass[] = [];
	const dry: PlanetClass[] = [];
	const cold: PlanetClass[] = [];
	const special: PlanetClass[] = [];
	const uninhab: PlanetClass[] = [];
	for (const c of classes) {
		if (!c.colonizable) uninhab.push(c);
		else if (c.isStandard && c.climate === 'wet') wet.push(c);
		else if (c.isStandard && c.climate === 'dry') dry.push(c);
		else if (c.isStandard && c.climate === 'cold') cold.push(c);
		else special.push(c);
	}
	return (
		[
			{ label: 'Wet climates', note: null, items: wet },
			{ label: 'Dry climates', note: null, items: dry },
			{ label: 'Cold climates', note: null, items: cold },
			{
				label: 'Special & engineered worlds',
				note: 'Colonizable, but outside the standard climate system.',
				items: special
			},
			{
				label: 'Uninhabitable bodies',
				note: 'Not colonizable as-is (some are terraformable or mineable).',
				items: uninhab
			}
		] satisfies PlanetGroup[]
	).filter((g) => g.items.length > 0);
}

// Tailwind classes for a climate chip.
export function climateBadge(climate: string | null): string {
	switch (climate) {
		case 'wet':
			return 'bg-sky-500/15 text-sky-300/90';
		case 'dry':
			return 'bg-amber-500/15 text-amber-300/90';
		case 'cold':
			return 'bg-cyan-500/15 text-cyan-300/90';
		default:
			return 'bg-surface-500/20 opacity-60';
	}
}
