import { describe, it, expect } from 'vitest';
import type { Ideology, Tenet, TenetModifier } from '#lib/server/db/index.ts';
import {
	anyIdeologyTenets,
	ethicSections,
	sharedFamilies,
	tenetFamily,
	tierEffects,
	tierRows
} from '#lib/ideologies.ts';

const tenet = (key: string, ethics: string[], extra: Partial<Tenet> = {}): Tenet => ({
	key,
	name: key,
	description: null,
	ethics,
	priority: 'default',
	sourceCivic: null,
	potential: null,
	unlockText: null,
	lockText: null,
	swaps: [],
	tiers: [],
	unlocks: [],
	...extra
});

const mod = (key: string, value: number, extra: Partial<TenetModifier> = {}): TenetModifier => ({
	key,
	value,
	label: null,
	positiveIsGood: true,
	potential: null,
	scope: 'country',
	possible: null,
	...extra
});

const ideology = (key: string, ethic: string): Ideology => ({
	key,
	ethic,
	secondaryEthic: null,
	opposedSecondaryEthic: null,
	faction: null,
	factionName: null,
	reach: null,
	typeName: null,
	levels: [],
	modifiers: []
});

describe('ethicSections', () => {
	it('groups types and tenets per ethic, in the ideologies order', () => {
		const s = ethicSections(
			[
				ideology('xenophobe_militarist', 'ethic_xenophobe'),
				ideology('xenophobe_pacifist', 'ethic_xenophobe'),
				ideology('materialist', 'ethic_materialist')
			],
			[
				tenet('tenet_curiosity', ['ethic_materialist']),
				tenet('tenet_security', ['ethic_xenophobe']),
				tenet('tenet_stability', [])
			]
		);
		expect(s.map((x) => [x.ethic, x.ideologies.length, x.tenets.map((t) => t.key)])).toEqual([
			['ethic_xenophobe', 2, ['tenet_security']],
			['ethic_materialist', 1, ['tenet_curiosity']]
		]);
		expect(anyIdeologyTenets([tenet('a', []), tenet('b', ['ethic_x'])]).map((t) => t.key)).toEqual([
			'a'
		]);
	});
});

describe('tenet families', () => {
	it('strips the ethic a tenet is written for', () => {
		expect(tenetFamily(tenet('tenet_strategism_pacifist', ['ethic_pacifist']))).toBe(
			'tenet_strategism'
		);
		expect(tenetFamily(tenet('tenet_curiosity', ['ethic_materialist']))).toBe('tenet_curiosity');
	});

	it('is shared only when every ethic has one', () => {
		const ts = [
			tenet('tenet_strategism_a', ['ethic_a']),
			tenet('tenet_strategism_b', ['ethic_b']),
			tenet('tenet_lost_makers_a', ['ethic_a'])
		];
		expect([...sharedFamilies(ts, ['ethic_a', 'ethic_b'])]).toEqual(['tenet_strategism']);
	});
});

describe('tierRows', () => {
	it('lines a stat up across tiers, conditions apart', () => {
		const gestalt = { leaf: 'is_gestalt', value: 'yes' };
		const t = tenet('t', [], {
			tiers: [
				{ tier: 1, effect: null, modifiers: [mod('a', 1), mod('b', 0.1, { potential: gestalt })] },
				{ tier: 2, effect: null, modifiers: [mod('a', 2)] },
				{ tier: 3, effect: null, modifiers: [mod('a', 3), mod('b', 0.3, { potential: gestalt })] }
			]
		});
		const { tiers, rows } = tierRows(t);
		expect(tiers).toEqual([1, 2, 3]);
		expect(rows.map((r) => [r.mod.key, r.values])).toEqual([
			['a', [1, 2, 3]],
			['b', [0.1, null, 0.3]]
		]);
	});
});

describe('tierEffects', () => {
	it('shows a repeated text once', () => {
		const t = tenet('t', [], {
			tiers: [
				{ tier: 1, effect: 'Allows X', modifiers: [] },
				{ tier: 2, effect: 'Allows X', modifiers: [] },
				{ tier: 3, effect: 'Allows X and Y', modifiers: [] }
			]
		});
		expect(tierEffects(t)).toEqual([
			{ tier: 1, text: 'Allows X' },
			{ tier: 3, text: 'Allows X and Y' }
		]);
	});
});
