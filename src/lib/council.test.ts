import { describe, it, expect } from 'vitest';
import type { Civic, CouncilPosition } from '$lib/server/db';
import { councilSeatRows, seatClasses } from './council';

const civic = (key: string, name: string, civicType = 'normal'): Civic => ({
	key,
	name,
	description: null,
	civicType,
	requiredDlc: null,
	locked: false,
	ascensionLock: null,
	ascensionBlocks: [],
	icon: null,
	modifiers: [],
	requirements: []
});
const seat = (key: string, name: string, classes: string[], mod: string): CouncilPosition => ({
	key,
	name,
	description: null,
	leaderClasses: classes,
	effect: null,
	modifiers: [{ key: mod, value: 0.02, label: null, positiveIsGood: true }]
});

const civics = [
	civic('civic_a', 'Zealots'),
	civic('civic_b', 'Brokers', 'corporate'),
	civic('civic_none', 'No Seat')
];
const council = {
	civic_a: seat('councilor_a', 'High Priest', ['official'], 'country_unity_produces_mult'),
	civic_b: seat('councilor_b', 'Accountant', ['official', 'scientist'], 'trade_value_mult')
};

describe('councilSeatRows', () => {
	it('lists civics with a seat, by seat name', () => {
		expect(councilSeatRows(civics, council).map((r) => r.seat.name)).toEqual([
			'Accountant',
			'High Priest'
		]);
	});
	it('filters by effect text and leader class', () => {
		expect(councilSeatRows(civics, council, { query: 'unity' }).map((r) => r.civic.key)).toEqual([
			'civic_a'
		]);
		expect(
			councilSeatRows(civics, council, { leaderClass: 'scientist' }).map((r) => r.civic.key)
		).toEqual(['civic_b']);
	});
	it('sorts by civic or group', () => {
		expect(councilSeatRows(civics, council, { sort: 'civic' }).map((r) => r.civic.name)).toEqual([
			'Brokers',
			'Zealots'
		]);
		expect(councilSeatRows(civics, council, { sort: 'group' }).map((r) => r.group)).toEqual([
			'Corporate',
			'Regular'
		]);
	});
	it('collects leader classes', () => {
		expect(seatClasses(council)).toEqual(['official', 'scientist']);
	});
});
