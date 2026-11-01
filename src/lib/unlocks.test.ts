import { describe, it, expect } from 'vitest';
import type { Trigger } from '$lib/server/db';
import { picksIn, unlocksByPick, type Unlock } from './unlocks';

const leaf = (l: string, value: string): Trigger => ({ leaf: l, value });
const and = (...args: Trigger[]): Trigger => ({ op: 'and', args });

describe('picksIn', () => {
	it('reads civics, origins and authorities a trigger requires', () => {
		expect(
			picksIn(
				and(leaf('has_origin', 'origin_doomsday'), leaf('is_nomadic', 'no')),
				leaf('has_valid_civic', 'civic_machine_servitor')
			)
		).toEqual([
			{ kind: 'origin', key: 'origin_doomsday' },
			{ kind: 'civic', key: 'civic_machine_servitor' }
		]);
	});
	it('resolves scripted triggers', () => {
		expect(picksIn(leaf('is_death_cult_empire', 'yes')).map((p) => p.key)).toEqual([
			'civic_death_cult',
			'civic_death_cult_corporate'
		]);
		expect(picksIn(leaf('is_megacorp', 'yes'))).toEqual([
			{ kind: 'authority', key: 'auth_corporate' }
		]);
	});
	it('skips exclusions', () => {
		expect(
			picksIn({ op: 'not', args: [leaf('has_valid_civic', 'civic_criminal_heritage')] })
		).toEqual([]);
		expect(picksIn(leaf('is_megacorp', 'no'))).toEqual([]);
	});
});

describe('unlocksByPick', () => {
	it('lists each unlock under every pick it needs', () => {
		const u = { key: 'x', picks: picksIn(leaf('is_death_cult_empire', 'yes')) } as Unlock;
		expect(Object.keys(unlocksByPick([u]))).toEqual([
			'civic:civic_death_cult',
			'civic:civic_death_cult_corporate'
		]);
	});
});
