import { describe, it, expect } from 'vitest';
import {
	allowedAscensionPaths,
	ascensionGates,
	conflictsFor,
	grantedTraits,
	violations,
	type Picks
} from './compat';
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
		rule('trait', 'trait_aquatic', 'planet_class', 'require_any', 'pc_ocean', 1),
		rule('civic', 'civic_environmentalist', 'gameplay', 'forbid', 'nomadic')
	],
	grantedTraits: {
		civic_tankbound: ['trait_tankbound'],
		civic_anglers: ['trait_aquatic']
	},
	opposites: {
		trait_tankbound: ['trait_weak', 'trait_hollow_bones', 'trait_photoadaptive'],
		trait_pc_ark_preference: ['trait_resilient', 'trait_genetic_memory', 'trait_sedentary']
	},
	archetypeByClass: { HUM: 'BIOLOGICAL', NECROID: 'BIOLOGICAL', MACHINE: 'MACHINE' },
	ascension: {
		origin_evolutionary_predators: { lock: 'Genetic', blocks: [] },
		origin_mindwardens: { lock: null, blocks: ['Psionic'] },
		civic_chosen: { lock: 'Psionic', blocks: [] },
		civic_natural_design: {
			lock: null,
			blocks: ['Genetic', 'Cybernetic', 'Synthetic', 'Psionic']
		}
	}
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

describe('homeworld', () => {
	it('Arkship means nomadic play: settled-only civics clash', () => {
		const ark = picks({ homeworld: 'pc_ark' });
		expect(
			texts(conflictsFor(ark, { kind: 'civic', key: 'civic_environmentalist' }, data, name))
		).toEqual(['civic_environmentalist (civic) rules out nomadic gameplay']);
		expect(conflictsFor(ark, { kind: 'civic', key: 'civic_caravan' }, data, name)).toEqual([]);
		// and the other direction: Arkship is flagged while the civic is picked
		const env = picks({ civics: ['civic_environmentalist'] });
		expect(conflictsFor(env, { kind: 'planet_class', key: 'pc_ark' }, data, name)).toHaveLength(1);
	});

	it('a settled homeworld clashes with a nomads-only origin', () => {
		const p = picks({ homeworld: 'pc_desert' });
		expect(
			texts(conflictsFor(p, { kind: 'origin', key: 'origin_default_nomads' }, data, name))
		).toEqual(['origin_default_nomads (origin) needs nomadic gameplay']);
	});

	it("the Arkship climate trait's opposites clash (Sedentary)", () => {
		const ark = picks({ homeworld: 'pc_ark' });
		expect(texts(conflictsFor(ark, { kind: 'trait', key: 'trait_sedentary' }, data, name))).toEqual(
			['pc_ark homeworld rules out trait_sedentary']
		);
		expect(conflictsFor(ark, { kind: 'trait', key: 'trait_strong' }, data, name)).toEqual([]);
	});
});

describe('ascension paths', () => {
	it('an origin lock against a civic lock leaves no path', () => {
		const p = picks({ origin: 'origin_evolutionary_predators' });
		expect(texts(conflictsFor(p, { kind: 'civic', key: 'civic_chosen' }, data, name))).toEqual([
			'origin_evolutionary_predators (origin) locks ascension to Genetic, civic_chosen (civic) locks ascension to Psionic'
		]);
	});

	it('a block against a lock on the same path also leaves none', () => {
		const p = picks({ origin: 'origin_mindwardens' });
		expect(conflictsFor(p, { kind: 'civic', key: 'civic_chosen' }, data, name)).toHaveLength(1);
	});

	it('the open paths are what every gate allows', () => {
		const gen = picks({ origin: 'origin_evolutionary_predators' });
		expect(allowedAscensionPaths(ascensionGates(gen, data))).toEqual(['Genetic']);
		expect(allowedAscensionPaths(ascensionGates(picks(), data))).toEqual([
			'Genetic',
			'Cybernetic',
			'Synthetic',
			'Psionic'
		]);
	});

	it('Natural Design alone blocks every path without being a conflict', () => {
		const p = picks({ civics: ['civic_natural_design'], origin: 'origin_evolutionary_predators' });
		expect(violations(p, data, name)).toEqual([]);
		expect(allowedAscensionPaths(ascensionGates(p, data))).toEqual([]);
	});
});
