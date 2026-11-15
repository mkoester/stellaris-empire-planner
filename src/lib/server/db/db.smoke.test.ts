// Runs every loader against the real game DB (STELLARIS_DB), so a DB the code does not fit — an
// older extraction without a table or column, a value the planner has no branch for — fails the
// build instead of a page. Not skipped without a DB: a skipped check looks like a passing one.
import { describe, it, expect } from 'vitest';
import * as loaders from '#lib/server/db/index.ts';
import { REWARD_VARIANTS } from '#lib/precursors.ts';

const size = (v: unknown): number =>
	v instanceof Map || v instanceof Set
		? v.size
		: Array.isArray(v)
			? v.length
			: typeof v === 'object' && v !== null
				? Object.keys(v).length
				: v === null || v === undefined
					? 0
					: 1;

const noArgLoaders = Object.entries(loaders as Record<string, unknown>).flatMap(([name, f]) =>
	typeof f === 'function' && name.startsWith('load') && f.length === 0
		? [[name, f as () => unknown] as const]
		: []
);

describe('the game DB fits the loaders', () => {
	it('finds the loaders', () => {
		expect(noArgLoaders.length).toBeGreaterThan(40);
	});

	it.each(noArgLoaders)('%s returns data', (_name, load) => {
		expect(size(load())).toBeGreaterThan(0);
	});

	it('loadTechCard builds a card for a tech, and none for an unknown key', () => {
		expect(loaders.loadTechCard('tech_lasers_1')?.title).toBeTruthy();
		expect(loaders.loadTechCard('no_such_tech')).toBeNull();
	});

	it('loadTraitsForKeys returns the traits asked for', () => {
		const keys = loaders
			.loadTraits()
			.slice(0, 3)
			.map((t) => t.key);
		expect(
			loaders
				.loadTraitsForKeys(keys)
				.map((t) => t.key)
				.sort()
		).toEqual([...keys].sort());
	});

	it('every precursor reward variant is one variantApplies knows', () => {
		const variants = new Set(
			loaders.loadPrecursors().flatMap((p) => p.rewards.map((r) => r.variant))
		);
		expect(
			[...variants].filter((v) => !(REWARD_VARIANTS as readonly string[]).includes(v))
		).toEqual([]);
	});
});
