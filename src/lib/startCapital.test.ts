import { describe, it, expect } from 'vitest';
import type { Trigger } from '$lib/server/db';
import {
	reasonText,
	simulateStartCapital,
	type CapitalInputs,
	type Effect
} from '$lib/startCapital';

const L = (leaf: string, value = 'yes', extra: Partial<Trigger> = {}): Trigger =>
	({ leaf, value, ...extra }) as Trigger;
const and = (...args: Trigger[]): Trigger => ({ op: 'and', args });
const or = (...args: Trigger[]): Trigger => ({ op: 'or', args });
const not = (a: Trigger): Trigger => ({ op: 'not', args: [a] });
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
		expect(c.districts).toMatchObject([{ district: 'district_city', count: 2 }]);
		expect(c.zones).toMatchObject([
			{ district: 'district_city', zone: 'zone_research_unity', slot: 1 }
		]);
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
		const bio = { leaf: 'uses_ship_category', value: 'bio_ship' };
		expect(c.districts).toEqual([
			{ district: 'district_generator', count: 4, parts: [{ amount: 4, reasons: [] }] },
			{
				district: 'district_farming',
				count: 2,
				parts: [
					{ amount: 1, reasons: [] },
					{ amount: 1, reasons: [bio] }
				]
			}
		]);
	});

	it('explains each pick by the conditions that led to it', () => {
		const anglers = { leaf: 'has_valid_civic', value: 'civic_anglers' };
		const c = simulateStartCapital(
			[
				{ e: 'set_variable', which: 'farming_districts', value: 3 },
				iff([
					or(L('has_valid_civic', 'civic_corporate_anglers'), anglers as Trigger),
					[
						{ e: 'set_flag', flag: 'uncapped_farming' },
						{ e: 'change_variable', which: 'farming_districts', value: -1 },
						{ e: 'add_district', district: 'district_farming', amount: 1 }
					]
				]),
				iff([
					and(L('is_regular_empire'), not(L('is_hive_empire')), L('is_nomadic', 'no')),
					[{ e: 'add_building', building: 'building_capital' }]
				]),
				iff([
					L('has_carrier_flag', 'uncapped_farming'),
					[{ e: 'add_zone', district: 'district_farming', zone: 'zone_anglers' }]
				]),
				iff([
					L('has_ethic', 'ethic_materialist'),
					[iff([L('is_planet_class', 'pc_ocean'), [{ e: 'add_building', building: 'lab' }]])]
				]),
				{ e: 'add_district', district: 'district_farming', amount: 'farming_districts' }
			],
			{ ...materialist, profile: { ...materialist.profile, civics: ['civic_anglers'] } }
		);
		expect(c.buildings).toEqual([
			{
				building: 'building_capital',
				zone: null,
				reasons: [{ leaf: 'is_regular_empire', value: 'yes' }]
			},
			{
				building: 'lab',
				zone: null,
				reasons: [
					{ leaf: 'has_ethic', value: 'ethic_materialist' },
					{ leaf: 'is_planet_class', value: 'pc_ocean' }
				]
			}
		]);
		expect(c.zones[0].reasons).toEqual([anglers]);
		expect(c.districts[0]).toEqual({
			district: 'district_farming',
			count: 3,
			// Anglers turns one capped district into an uncapped one: no net change.
			parts: [{ amount: 3, reasons: [] }]
		});
	});

	it('words reasons by what they are about', () => {
		const names = { ethic_materialist: 'Materialist', pc_ocean: 'Ocean World' };
		expect(reasonText({ leaf: 'has_ethic', value: 'ethic_materialist' }, names)).toBe(
			'Materialist (ethic)'
		);
		expect(reasonText({ leaf: 'is_planet_class', value: 'pc_ocean' }, names)).toBe(
			'Ocean World (homeworld)'
		);
		expect(reasonText({ leaf: 'is_hive_empire', value: 'yes' }, names)).toBe('Hive Mind');
		expect(reasonText({ leaf: 'is_archetype', value: 'LITHOID' }, names)).toBe('Lithoid species');
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
