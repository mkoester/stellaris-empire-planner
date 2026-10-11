import { describe, it, expect } from 'vitest';
import { betterVersions, traitRequirementLines } from './traits';

const mod = (key: string, value: number) => ({ key, value, label: null, positiveIsGood: true });
const trait = (
	key: string,
	category: string,
	cost: number,
	mods: [string, number][],
	archetypes = ['BIOLOGICAL']
) => ({
	key,
	category,
	cost,
	archetypes,
	tags: [cost < 0 ? 'negative' : 'positive'],
	modifiers: mods.map(([k, v]) => mod(k, v))
});

const RESEARCH = 'researcher_jobs_bonus_workforce_mult';
const intelligent = trait('trait_intelligent', 'normal', 2, [[RESEARCH, 0.1]]);
const all = [
	intelligent,
	trait('trait_cyborg_infinity_sphere', 'cyborg', 2, [[RESEARCH, 0.25]]), // larger, same cost
	trait('trait_cheap_research', 'overtuned', 1, [[RESEARCH, 0.1]]), // same, cheaper
	trait('trait_pricey_research', 'psionic', 3, [[RESEARCH, 0.25]]), // larger but dearer
	trait('trait_weaker_research', 'cyborg', 1, [[RESEARCH, 0.05]]), // cheaper but weaker
	trait('trait_robot_infinity_sphere', 'robotic', 2, [[RESEARCH, 0.25]], ['MACHINE']),
	trait('trait_smart_kin', 'normal', 2, [[RESEARCH, 0.2]]) // same category
];
const keys = (ts: { key: string }[]) => ts.map((t) => t.key);

describe('betterVersions', () => {
	it('larger effect and/or cheaper, in another category, for this archetype', () => {
		expect(keys(betterVersions(intelligent, all, 'BIOLOGICAL'))).toEqual([
			'trait_cheap_research',
			'trait_cyborg_infinity_sphere'
		]);
	});

	it('must give every modifier of the base trait', () => {
		const strong = trait('trait_strong', 'normal', 1, [
			['army_damage_mult', 0.2],
			['soldier_jobs_bonus_workforce_mult', 0.1]
		]);
		const partial = trait('trait_army_only', 'overtuned', 1, [['army_damage_mult', 0.4]]);
		const full = trait('trait_juiced_power', 'overtuned', 1, [
			['army_damage_mult', 0.4],
			['soldier_jobs_bonus_workforce_mult', 0.15],
			['leader_lifespan_add', -10]
		]);
		expect(keys(betterVersions(strong, [strong, partial, full], 'BIOLOGICAL'))).toEqual([
			'trait_juiced_power'
		]);
	});

	it('drawback traits have no better version', () => {
		const weak = trait('trait_weak', 'normal', -1, [['army_damage_mult', -0.2]]);
		const worse = trait('trait_delicate', 'cyborg', -1, [['army_damage_mult', -0.5]]);
		expect(betterVersions(weak, [weak, worse], 'BIOLOGICAL')).toEqual([]);
	});
});

describe('traitRequirementLines', () => {
	it('rules the trait owns plus its opposites, as needs / excl. lines', () => {
		const rules = [
			{
				ownerKind: 'trait' as const,
				owner: 'trait_aquatic',
				kind: 'planet_class',
				operator: 'require_any' as const,
				value: 'pc_ocean',
				groupId: 1
			},
			{
				ownerKind: 'trait' as const,
				owner: 'trait_aquatic',
				kind: 'origin',
				operator: 'forbid' as const,
				value: 'origin_void_dwellers',
				groupId: 0
			},
			{
				ownerKind: 'civic' as const,
				owner: 'trait_aquatic',
				kind: 'ethic',
				operator: 'forbid' as const,
				value: 'x',
				groupId: 0
			}
		];
		const names = { pc_ocean: 'Ocean', origin_void_dwellers: 'Void Dwellers', trait_weak: 'Weak' };
		expect(
			traitRequirementLines({ key: 'trait_aquatic', opposites: ['trait_weak'] }, rules, names)
		).toEqual([
			{ kind: 'origin', type: 'exclude', text: 'Void Dwellers' },
			{ kind: 'trait', type: 'exclude', text: 'Weak' },
			{ kind: 'planet_class', type: 'require', text: 'Ocean homeworld' }
		]);
	});
});
