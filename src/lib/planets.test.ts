import { describe, it, expect } from 'vitest';
import type { PlanetClass } from '$lib/server/db';
import { groupPlanetClasses } from './planets';

const pc = (o: Partial<PlanetClass> & { key: string }): PlanetClass => ({
	name: o.key,
	climate: null,
	colonizable: true,
	isStandard: false,
	...o
});

describe('groupPlanetClasses', () => {
	it('splits standard climates, special worlds, and uninhabitable bodies', () => {
		const groups = groupPlanetClasses([
			pc({ key: 'pc_ocean', climate: 'wet', isStandard: true }),
			pc({ key: 'pc_desert', climate: 'dry', isStandard: true }),
			pc({ key: 'pc_tundra', climate: 'cold', isStandard: true }),
			pc({ key: 'pc_gaia' }), // colonizable, no climate → special
			pc({ key: 'pc_relic', climate: 'dry', isStandard: false }), // colonizable, not standard → special
			pc({ key: 'pc_barren', colonizable: false }) // uninhabitable
		]);
		const byLabel = Object.fromEntries(groups.map((g) => [g.label, g.items.map((i) => i.key)]));
		expect(byLabel['Wet climates']).toEqual(['pc_ocean']);
		expect(byLabel['Dry climates']).toEqual(['pc_desert']);
		expect(byLabel['Cold climates']).toEqual(['pc_tundra']);
		expect(byLabel['Special & engineered worlds']).toEqual(['pc_gaia', 'pc_relic']);
		expect(byLabel['Uninhabitable bodies']).toEqual(['pc_barren']);
	});
	it('omits empty groups', () => {
		const groups = groupPlanetClasses([pc({ key: 'pc_ocean', climate: 'wet', isStandard: true })]);
		expect(groups.map((g) => g.label)).toEqual(['Wet climates']);
	});
});
