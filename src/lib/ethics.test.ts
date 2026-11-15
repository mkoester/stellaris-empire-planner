import { describe, it, expect } from 'vitest';
import type { Ethic } from '#lib/server/db/index.ts';
import { combineImplications, combinePolicyRestrictions } from '#lib/ethics.ts';

const ethic = (key: string, label: string | null, extra: Partial<Ethic>): Ethic =>
	({ key, label, implications: [], policyRestrictions: [], ...extra }) as Ethic;

describe('combineImplications', () => {
	it('lists each implication once, with every ethic that brings it', () => {
		const a = ethic('ethic_a', 'A', {
			implications: [
				{ tag: 'slavery', label: 'Can enslave' },
				{ tag: 'purge', label: 'Can purge' }
			]
		} as Partial<Ethic>);
		const b = ethic('ethic_b', null, {
			implications: [{ tag: 'slavery', label: 'Can enslave' }]
		} as Partial<Ethic>);
		expect(combineImplications([a, b])).toEqual([
			{ label: 'Can enslave', sources: ['A', 'ethic_b'] }, // no label: the key
			{ label: 'Can purge', sources: ['A'] }
		]);
	});
});

describe('combinePolicyRestrictions', () => {
	it('keys on policy and option together, and falls back to the option key', () => {
		const pr = (policyKey: string, optionKey: string, optionLabel: string | null) => ({
			policyKey,
			optionKey,
			optionLabel
		});
		const a = ethic('ethic_a', 'A', {
			policyRestrictions: [pr('war', 'none', 'No wars'), pr('trade', 'none', null)]
		} as Partial<Ethic>);
		const b = ethic('ethic_b', 'B', {
			policyRestrictions: [pr('war', 'none', 'No wars')]
		} as Partial<Ethic>);
		expect(combinePolicyRestrictions([a, b])).toEqual([
			{ label: 'No wars', sources: ['A', 'B'] },
			{ label: 'none', sources: ['A'] } // same option key under another policy: its own line
		]);
	});
});
