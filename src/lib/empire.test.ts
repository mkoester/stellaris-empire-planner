import { describe, it, expect, beforeEach } from 'vitest';
import { empire } from './empire.svelte';
import type { Empire } from '$lib/server/db';

const mk = (o: Partial<Empire>): Empire => ({
	key: 'e',
	name: 'Test Empire',
	speciesClass: null,
	speciesPortrait: null,
	authority: null,
	government: null,
	origin: null,
	planetClass: null,
	graphicalCulture: null,
	ethics: [],
	civics: [],
	traits: [],
	source: 'file',
	...o
});

describe('empire store', () => {
	beforeEach(() => empire.reset());

	it("apply 'all' sets every section", () => {
		empire.apply(
			mk({
				speciesClass: 'REP',
				traits: ['trait_strong'],
				ethics: ['ethic_authoritarian'],
				origin: 'origin_default'
			}),
			'all'
		);
		expect(empire.draft.speciesClass).toBe('REP');
		expect(empire.draft.traits).toEqual(['trait_strong']);
		expect(empire.draft.ethics).toEqual(['ethic_authoritarian']);
		expect(empire.draft.origin).toBe('origin_default');
		expect(empire.anySet()).toBe(true);
	});

	it("apply 'partial' fills only the unset sections, keeping set ones", () => {
		empire.setEthics(['ethic_pacifist']); // ethics already set
		empire.apply(
			mk({ ethics: ['ethic_authoritarian'], traits: ['trait_strong'], origin: 'origin_default' }),
			'partial'
		);
		expect(empire.draft.ethics).toEqual(['ethic_pacifist']); // kept
		expect(empire.draft.traits).toEqual(['trait_strong']); // filled
		expect(empire.draft.origin).toBe('origin_default'); // filled
	});

	it('section setters update the draft and mark those sections as set', () => {
		empire.setOrigin('origin_shattered_ring');
		empire.toggleCivic('civic_technocracy');
		empire.setPlanetClass('pc_ocean');
		empire.setShipType('organic');
		expect(empire.draft.origin).toBe('origin_shattered_ring');
		expect(empire.draft.civics).toEqual(['civic_technocracy']);
		expect(empire.draft.planetClass).toBe('pc_ocean');
		expect(empire.draft.graphicalCulture).toBe('biogenesis_01'); // organic
		expect(empire.setSectionLabels()).toEqual(
			expect.arrayContaining(['Origin', 'Civics', 'Homeworld', 'Ship type'])
		);
	});

	it('toggleCivic adds then removes a civic', () => {
		empire.toggleCivic('civic_x');
		expect(empire.draft.civics).toEqual(['civic_x']);
		empire.toggleCivic('civic_x');
		expect(empire.draft.civics).toEqual([]);
	});

	it('reports the set sections and bumps generation on load', () => {
		const g0 = empire.generation;
		empire.setEthics(['ethic_pacifist']);
		expect(empire.setSectionLabels()).toEqual(['Ethics']);
		empire.apply(mk({ traits: ['trait_strong'] }), 'all');
		expect(empire.generation).toBeGreaterThan(g0);
	});
});
