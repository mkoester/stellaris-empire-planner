import { describe, it, expect } from 'vitest';
import type { Trigger } from '$lib/server/db';
import { simulateStartCapital, type CapitalInputs, type Effect } from '$lib/startCapital';

const L = (leaf: string, value = 'yes', extra: Partial<Trigger> = {}): Trigger =>
	({ leaf, value, ...extra }) as Trigger;
const iff = (...branches: [Trigger | null, Effect[]][]): Effect => ({
	e: 'if',
	branches: branches.map(([limit, body]) => ({ limit, body }))
});

const materialist: CapitalInputs = {
	profile: {
		authority: 'regular',
		flags: [],
		ethics: ['ethic_materialist', 'ethic_xenophile'],
		civics: [],
		origin: 'origin_default'
	},
	authority: 'auth_democratic',
	traits: ['trait_organic'],
	archetype: 'BIOLOGICAL',
	planetClass: 'pc_ocean',
	bioShips: false
};

describe('simulateStartCapital', () => {
	it('adds the zone before the building that goes into it', () => {
		const c = simulateStartCapital(
			[
				{ e: 'add_building', building: 'building_capital' },
				{ e: 'add_district', district: 'district_city', amount: 2 },
				{ e: 'add_zone', district: 'district_city', zone: 'zone_research_unity', slot: 1 },
				iff([
					L('has_ethic', 'ethic_materialist'),
					[
						iff([
							L('has_zone', 'zone_research_unity'),
							[
								{
									e: 'add_building',
									building: 'building_research_lab_1',
									zone: 'zone_research_unity'
								}
							]
						])
					]
				])
			],
			materialist
		);
		expect(c.districts).toEqual([{ district: 'district_city', count: 2 }]);
		expect(c.zones).toEqual([{ district: 'district_city', zone: 'zone_research_unity', slot: 1 }]);
		expect(c.buildings.map((b) => b.building)).toEqual([
			'building_capital',
			'building_research_lab_1'
		]);
		expect(c.unknownChecks).toEqual([]);
	});

	it('takes the first branch that holds, else the else', () => {
		const pick = (inp: CapitalInputs) =>
			simulateStartCapital(
				[
					iff(
						[L('is_hive_empire'), [{ e: 'add_building', building: 'hive' }]],
						[L('is_planet_class', 'pc_ocean'), [{ e: 'add_building', building: 'ocean' }]],
						[null, [{ e: 'add_building', building: 'other' }]]
					)
				],
				inp
			).buildings[0].building;
		expect(pick(materialist)).toBe('ocean');
		expect(pick({ ...materialist, planetClass: 'pc_arid' })).toBe('other');
		expect(pick({ ...materialist, profile: { ...materialist.profile, authority: 'hive' } })).toBe(
			'hive'
		);
	});

	it('counts rural districts with variables, a while loop and check_variable', () => {
		const c = simulateStartCapital(
			[
				{ e: 'set_variable', which: 'farming_districts', value: 3 },
				{ e: 'set_variable', which: 'energy_districts', value: 2 },
				iff([
					L('uses_ship_category', 'bio_ship'),
					[{ e: 'change_variable', which: 'farming_districts', value: 1 }]
				]),
				{
					e: 'while',
					count: 2,
					limit: null,
					body: [
						iff([
							L('check_variable', '0', { cmp: '>', which: 'farming_districts' }),
							[
								{ e: 'change_variable', which: 'farming_districts', value: -1 },
								{ e: 'change_variable', which: 'energy_districts', value: 1 }
							]
						])
					]
				},
				{ e: 'add_district', district: 'district_generator', amount: 'energy_districts' },
				{ e: 'add_district', district: 'district_farming', amount: 'farming_districts' }
			],
			{ ...materialist, bioShips: true }
		);
		expect(c.districts).toEqual([
			{ district: 'district_generator', count: 4 },
			{ district: 'district_farming', count: 2 }
		]);
	});

	it('treats an undecidable limit as false and reports what it hinged on', () => {
		const c = simulateStartCapital(
			[
				iff(
					[L('has_country_flag', 'x'), [{ e: 'add_building', building: 'flagged' }]],
					[L('mystery_check'), [{ e: 'add_building', building: 'mystery' }]],
					[null, [{ e: 'add_building', building: 'fallback' }]]
				),
				{ e: 'unknown', key: 'odd_effect' }
			],
			materialist
		);
		expect(c.buildings.map((b) => b.building)).toEqual(['fallback']);
		expect(c.unknownChecks).toEqual([{ leaf: 'mystery_check', value: 'yes' }]);
		expect(c.unknownEffects).toEqual(['odd_effect']);
	});

	it('derives archetype traits, removes buildings and zones', () => {
		const c = simulateStartCapital(
			[
				{ e: 'add_building', building: 'a' },
				{ e: 'add_building', building: 'a', unique: true },
				{ e: 'add_zone', district: 'd', zone: 'z' },
				iff([
					L('has_trait', 'trait_machine_unit'),
					[
						{ e: 'remove_all_buildings' },
						{ e: 'remove_zone', district: 'd', zone: 'z' },
						{ e: 'add_building', building: 'b' }
					]
				])
			],
			{ ...materialist, archetype: 'MACHINE', traits: [] }
		);
		expect(c.buildings.map((b) => b.building)).toEqual(['b']);
		expect(c.zones).toEqual([]);
	});
});
