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

	it('loadIdeologies: 8 ethics, three-tier tenets, the extra tenet slot found', () => {
		const d = loaders.loadIdeologies();
		expect(new Set(d.ideologies.map((i) => i.ethic)).size).toBe(8);
		expect(d.ideologies.every((i) => i.levels.length >= 1)).toBe(true);
		const stability = d.tenets.find((t) => t.key === 'tenet_stability');
		expect(stability?.tiers.map((t) => t.tier)).toEqual([1, 2, 3]);
		expect(d.extraTenetPerks.length).toBeGreaterThan(0);
		expect(d.extraTenetPerks.every((p) => p.pathKey !== null)).toBe(true);
	});

	it('loadAmbitions: every path is named and has levels', () => {
		const a = loaders.loadAmbitions();
		expect(a.filter((p) => !p.name || !p.levels.length).map((p) => p.key)).toEqual([]);
	});
});
