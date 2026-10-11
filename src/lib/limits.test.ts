import { describe, it, expect } from 'vitest';
import { addedBy, ethicLimits, traitLimits, type EthicInfo, type TraitInfo } from './limits';

const name = (k: string) => k;
const ethic = (key: string, cost: number, regular: string | null = null): EthicInfo => ({
	key,
	cost,
	regular_variant: regular
});
const ethics = [
	ethic('ethic_xenophile', 1),
	ethic('ethic_fanatic_xenophile', 2, 'ethic_xenophile'),
	ethic('ethic_xenophobe', 1),
	ethic('ethic_militarist', 1),
	ethic('ethic_fanatic_militarist', 2, 'ethic_militarist'),
	ethic('ethic_materialist', 1)
];
const checkEthics = (picked: string[]) => ethicLimits(picked, ethics, name);

describe('ethic limits', () => {
	it('a valid set breaks nothing', () => {
		expect(checkEthics(['ethic_fanatic_xenophile', 'ethic_militarist'])).toEqual([]);
	});

	it('flags an option that would overrun the points, and keeps it pickable', () => {
		const picked = ['ethic_fanatic_xenophile', 'ethic_militarist'];
		expect(addedBy(checkEthics, picked, 'ethic_materialist')).toEqual([
			'Ethics cost 4 of 3 points'
		]);
		// already over budget: a further pick still counts (the total is in the id)
		const over = [...picked, 'ethic_materialist'];
		expect(addedBy(checkEthics, over, 'ethic_fanatic_militarist')).toHaveLength(2);
	});

	it('opposite and same-axis ethics clash, regular and fanatic alike', () => {
		expect(addedBy(checkEthics, ['ethic_xenophile'], 'ethic_xenophobe')).toEqual([
			'ethic_xenophile and ethic_xenophobe share an ethic axis'
		]);
		expect(addedBy(checkEthics, ['ethic_xenophile'], 'ethic_fanatic_xenophile')).toContain(
			'ethic_xenophile and ethic_fanatic_xenophile share an ethic axis'
		);
		expect(addedBy(checkEthics, ['ethic_xenophile'], 'ethic_militarist')).toEqual([]);
	});

	it('flags a picked ethic that causes a clash (the other direction)', () => {
		expect(addedBy(checkEthics, ['ethic_xenophile', 'ethic_xenophobe'], 'ethic_xenophile')).toEqual(
			['ethic_xenophobe and ethic_xenophile share an ethic axis']
		);
	});
});

const info: TraitInfo = {
	costs: { trait_strong: 1, trait_smart: 2, trait_weak: -1, trait_history: 0 },
	opposites: { trait_strong: ['trait_weak'] },
	uncounted: new Set(['trait_history'])
};
const budget = { maxTraits: 2, maxPoints: 2 };
const checkTraits = (picked: string[]) => traitLimits(picked, budget, info, name);

describe('trait limits', () => {
	it('points: a negative trait pays for a positive one', () => {
		expect(addedBy(checkTraits, ['trait_smart'], 'trait_strong')).toEqual([
			'Traits cost 3 of 2 points'
		]);
		expect(checkTraits(['trait_smart', 'trait_weak'])).toEqual([]);
	});

	it('picks: history traits are outside the count', () => {
		expect(checkTraits(['trait_smart', 'trait_weak', 'trait_history'])).toEqual([]);
		expect(addedBy(checkTraits, ['trait_smart', 'trait_weak'], 'trait_strong')).toEqual([
			'3 traits picked, 2 allowed',
			'trait_weak and trait_strong are opposites'
		]);
	});

	it('without a known archetype only opposites are checked', () => {
		expect(traitLimits(['trait_smart', 'trait_smart2', 'trait_strong'], null, info, name)).toEqual(
			[]
		);
		expect(traitLimits(['trait_weak', 'trait_strong'], null, info, name)).toHaveLength(1);
	});
});
