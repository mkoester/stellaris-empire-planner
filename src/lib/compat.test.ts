import { describe, it, expect } from 'vitest';
import { conflictsFor, grantedTraits, violations, type Picks } from './compat';
import type { CompatData, CompatRule } from '$lib/server/db';

// Rule rows shaped like the extracted game data (origin_requirement / civic_requirement /
// trait_requirement, granted_trait, trait_opposite) for the cases under test.
const rule = (
	ownerKind: CompatRule['ownerKind'],
	owner: string,
	kind: string,
	operator: CompatRule['operator'],
	value: string,
	groupId = 0
): CompatRule => ({ ownerKind, owner, kind, operator, value, groupId });

const data: CompatData = {
	rules: [
		rule('origin', 'origin_necrophage', 'ethic', 'forbid', 'ethic_xenophile'),
		rule('origin', 'origin_necrophage', 'ethic', 'forbid', 'ethic_fanatic_xenophile'),
		rule('origin', 'origin_necrophage', 'ethic', 'forbid', 'ethic_fanatic_egalitarian'),
		...['NECROID', 'TOX', 'AQUATIC', 'INF'].map((v) =>
			rule('civic', 'civic_tankbound', 'species_class', 'require_any', v, 1)
		),
		rule('civic', 'civic_anglers', 'archetype', 'forbid', 'MACHINE'),
		rule('civic', 'civic_pyrolatry', 'trait', 'forbid', 'trait_aquatic'),
		rule('origin', 'origin_default_nomads', 'gameplay', 'require', 'nomadic'),
		rule('origin', 'origin_default', 'gameplay', 'forbid', 'nomadic'),
		rule('civic', 'civic_caravan', 'gameplay', 'require', 'nomadic'),
		rule('trait', 'trait_sedentary', 'origin', 'forbid', 'origin_default_nomads'),
		rule('trait', 'trait_aquatic', 'planet_class', 'require_any', 'pc_ocean', 1)
	],
	grantedTraits: {
		civic_tankbound: ['trait_tankbound'],
		civic_anglers: ['trait_aquatic']
	},
	opposites: { trait_tankbound: ['trait_weak', 'trait_hollow_bones', 'trait_photoadaptive'] },
	archetypeByClass: { HUM: 'BIOLOGICAL', NECROID: 'BIOLOGICAL', MACHINE: 'MACHINE' }
};

const name = (k: string) => k;
const picks = (o: Partial<Picks> = {}): Picks => ({
	ethics: [],
	civics: [],
	origin: null,
	authority: null,
	speciesClass: null,
	baseTrait: null,
	traits: [],
	secondaryTraits: [],
	homeworld: null,
	shipType: null,
	...o
});
const texts = (cs: { text: string }[]) => cs.map((c) => c.text);

describe('Necrophage vs ethics', () => {
	it('flags Xenophile while Necrophage is picked', () => {
		const p = picks({ origin: 'origin_necrophage' });
		expect(texts(conflictsFor(p, { kind: 'ethic', key: 'ethic_xenophile' }, data, name))).toEqual([
			'origin_necrophage (origin) rules out ethic_xenophile'
		]);
		expect(
			conflictsFor(p, { kind: 'ethic', key: 'ethic_fanatic_egalitarian' }, data, name)
		).toHaveLength(1);
		expect(conflictsFor(p, { kind: 'ethic', key: 'ethic_egalitarian' }, data, name)).toEqual([]);
	});

	it('flags Necrophage while Fanatic Xenophile is picked (the other direction)', () => {
		const p = picks({ ethics: ['ethic_fanatic_xenophile'] });
		expect(conflictsFor(p, { kind: 'origin', key: 'origin_necrophage' }, data, name)).toHaveLength(
			1
		);
	});

	it('still flags an option that is already picked', () => {
		const p = picks({ origin: 'origin_necrophage', ethics: ['ethic_xenophile'] });
		expect(violations(p, data, name)).toHaveLength(1);
		expect(conflictsFor(p, { kind: 'ethic', key: 'ethic_xenophile' }, data, name)).toHaveLength(1);
	});
});

describe('Tankbound', () => {
	it('needs one of the four species classes', () => {
		const p = picks({ civics: ['civic_tankbound'] });
		expect(texts(conflictsFor(p, { kind: 'species_class', key: 'HUM' }, data, name))).toEqual([
			'civic_tankbound (civic) needs one of NECROID species, TOX species, AQUATIC species, INF species'
		]);
		expect(conflictsFor(p, { kind: 'species_class', key: 'NECROID' }, data, name)).toEqual([]);
	});

	it('does not warn before a species class is chosen', () => {
		expect(violations(picks({ civics: ['civic_tankbound'] }), data, name)).toEqual([]);
	});

	it('grants trait_tankbound, whose opposites rule out Weak', () => {
		const p = picks({ civics: ['civic_tankbound'], speciesClass: 'NECROID' });
		expect(grantedTraits(p, data)).toEqual([
			{ trait: 'trait_tankbound', source: 'civic_tankbound' }
		]);
		expect(texts(conflictsFor(p, { kind: 'trait', key: 'trait_weak' }, data, name))).toEqual([
			'civic_tankbound gives the trait_tankbound trait, which rules out trait_weak'
		]);
		expect(conflictsFor(p, { kind: 'trait', key: 'trait_strong' }, data, name)).toEqual([]);
		// and the civic is flagged while Weak is picked
		const weak = picks({ traits: ['trait_weak'], speciesClass: 'NECROID' });
		expect(conflictsFor(weak, { kind: 'civic', key: 'civic_tankbound' }, data, name)).toHaveLength(
			1
		);
	});
});

describe('other gates', () => {
	it('archetype: Anglers rules out a machine species', () => {
		const p = picks({ speciesClass: 'MACHINE' });
		expect(conflictsFor(p, { kind: 'civic', key: 'civic_anglers' }, data, name)).toHaveLength(1);
	});

	it('granted traits count for trait gates (Anglers grants Aquatic; Pyrolatry rules it out)', () => {
		const p = picks({ civics: ['civic_anglers'] });
		expect(texts(conflictsFor(p, { kind: 'civic', key: 'civic_pyrolatry' }, data, name))).toEqual([
			'civic_pyrolatry (civic) rules out trait_aquatic'
		]);
	});

	it('trait gates: Sedentary vs a nomad origin, Aquatic vs a non-ocean homeworld', () => {
		const p = picks({ origin: 'origin_default_nomads' });
		expect(conflictsFor(p, { kind: 'trait', key: 'trait_sedentary' }, data, name)).toHaveLength(1);
		const h = picks({ homeworld: 'pc_desert' });
		expect(conflictsFor(h, { kind: 'trait', key: 'trait_aquatic' }, data, name)).toHaveLength(1);
		const ocean = picks({ homeworld: 'pc_ocean' });
		expect(conflictsFor(ocean, { kind: 'trait', key: 'trait_aquatic' }, data, name)).toEqual([]);
	});

	it('nomadic gameplay follows the origin', () => {
		const settled = picks({ origin: 'origin_default' });
		expect(conflictsFor(settled, { kind: 'civic', key: 'civic_caravan' }, data, name)).toHaveLength(
			1
		);
		const nomad = picks({ origin: 'origin_default_nomads' });
		expect(conflictsFor(nomad, { kind: 'civic', key: 'civic_caravan' }, data, name)).toEqual([]);
		expect(conflictsFor(picks(), { kind: 'civic', key: 'civic_caravan' }, data, name)).toEqual([]);
	});
});
