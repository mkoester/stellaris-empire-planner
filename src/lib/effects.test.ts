import { describe, it, expect } from 'vitest';
import { collectEffects, collectSpeciesEffects, groupEffects, effectGroupOf } from './effects';
import type { Modifier, ModifierSource } from '$lib/server/db';

const mod = (key: string, value: number, label: string | null = null): Modifier => ({
	key,
	value,
	label,
	positiveIsGood: true
});

const index: Record<string, ModifierSource> = {
	ethic_fanatic_egalitarian: {
		kind: 'ethic',
		modifiers: [mod('pop_factions_produces_mult', 0.3, 'Faction Resource Output')]
	},
	ethic_xenophile: { kind: 'ethic', modifiers: [mod('envoys_add', 1, 'Envoys')] },
	auth_democratic: {
		kind: 'authority',
		modifiers: [mod('country_leader_pool_size', 1, 'Leader Pool Size')]
	},
	civic_beacon_of_liberty: {
		kind: 'civic',
		modifiers: [mod('pop_happiness', 0.05, 'Pop Happiness')]
	},
	origin_idealistic_foundation: {
		kind: 'origin',
		modifiers: [mod('pop_happiness', 0.1, 'Citizen Pop Happiness')]
	},
	trait_adaptive: { kind: 'trait', modifiers: [mod('habitability_mult', 0.1, 'Habitability')] }
};
const names: Record<string, string> = {
	ethic_fanatic_egalitarian: 'Fanatic Egalitarian',
	ethic_xenophile: 'Xenophile',
	auth_democratic: 'Democratic',
	civic_beacon_of_liberty: 'Beacon of Liberty',
	origin_idealistic_foundation: 'Idealistic Foundation'
};

describe('collectEffects', () => {
	it('walks ethics → authority → civics → origin (not traits), keeping each source grouped', () => {
		const effects = collectEffects(
			{
				ethics: ['ethic_fanatic_egalitarian', 'ethic_xenophile'],
				authority: 'auth_democratic',
				civics: ['civic_beacon_of_liberty'],
				origin: 'origin_idealistic_foundation'
			},
			index,
			names
		);
		expect(effects.map((e) => [e.sourceKind, e.sourceName])).toEqual([
			['ethic', 'Fanatic Egalitarian'],
			['ethic', 'Xenophile'],
			['authority', 'Democratic'],
			['civic', 'Beacon of Liberty'],
			['origin', 'Idealistic Foundation']
		]);
		expect(effects[0].mod.label).toBe('Faction Resource Output');
	});

	it('skips keys with no modifier source and handles a null origin', () => {
		const effects = collectEffects(
			{ ethics: ['ethic_unknown'], civics: [], origin: null },
			index,
			names
		);
		expect(effects).toEqual([]);
	});
});

describe('collectSpeciesEffects', () => {
	it('groups trait effects per species, dropping species with no effects', () => {
		const groups = collectSpeciesEffects(
			[
				{ name: 'Humanoid', traits: ['trait_adaptive'] },
				{ name: 'Empty', traits: ['trait_unknown'] }
			],
			index,
			names
		);
		expect(groups).toHaveLength(1);
		expect(groups[0].species).toBe('Humanoid');
		expect(groups[0].entries.map((e) => [e.sourceKind, e.sourceName])).toEqual([
			['trait', 'Adaptive']
		]);
	});
});

describe('effectGroupOf', () => {
	const e = (kind: ModifierSource['kind'], key: string) => ({
		sourceKind: kind,
		sourceName: 'X',
		mod: mod(key, 1)
	});
	it('classifies effects by modifier key', () => {
		expect(effectGroupOf(e('civic', 'artisan_jobs_bonus_workforce_mult'))).toBe(
			'Jobs & resource output'
		);
		expect(effectGroupOf(e('ethic', 'pop_happiness'))).toBe('Pops');
		expect(effectGroupOf(e('origin', 'pc_ocean_habitability'))).toBe('Pops');
		expect(effectGroupOf(e('civic', 'planet_stability_add'))).toBe('Planets & construction');
		expect(effectGroupOf(e('ethic', 'all_technology_research_speed'))).toBe(
			'Research & technology'
		);
		expect(effectGroupOf(e('civic', 'country_naval_cap_add'))).toBe('Military & fleets'); // naval before country
		expect(effectGroupOf(e('ethic', 'envoys_add'))).toBe('Empire & diplomacy');
		expect(effectGroupOf(e('civic', 'ship_anomaly_research_speed_mult'))).toBe(
			'Research & technology'
		); // exploration ship, not Military
		expect(effectGroupOf(e('civic', 'something_unmatched'))).toBe('Other');
	});
});

describe('groupEffects', () => {
	it('buckets in display order (Empire → Pops → Jobs), keeps in-group order, drops empties', () => {
		const flat = [
			{
				sourceKind: 'civic' as const,
				sourceName: 'B',
				mod: mod('artisan_jobs_bonus_workforce_mult', 0.1)
			},
			{ sourceKind: 'ethic' as const, sourceName: 'A', mod: mod('envoys_add', 1) },
			{ sourceKind: 'ethic' as const, sourceName: 'A', mod: mod('pop_happiness', 0.05) }
		];
		const groups = groupEffects(flat);
		expect(groups.map((g) => g.label)).toEqual([
			'Empire & diplomacy',
			'Pops',
			'Jobs & resource output'
		]);
		expect(groups[0].entries).toHaveLength(1);
	});
});
