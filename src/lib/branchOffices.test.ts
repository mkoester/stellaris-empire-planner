import { describe, it, expect } from 'vitest';
import type { Civic, OwnedBuilding, OwnedBuildingEffect } from '$lib/server/db';
import {
	buildingJobs,
	civicBoosts,
	conditionText,
	jobCount,
	jobNames,
	splitEffects
} from './branchOffices';

const eff = (
	scope: 'planet' | 'country',
	key: string,
	value: number,
	ownerCivic: string | null = null,
	condition: string | null = null
): OwnedBuildingEffect => ({
	scope,
	modifier: { key, value, label: null, positiveIsGood: true },
	ownerCivic,
	condition
});
const building = (key: string, effects: OwnedBuildingEffect[]): OwnedBuilding => ({
	key,
	name: key,
	category: 'resource',
	description: null,
	resources: [],
	jobs: [],
	modifiers: [],
	unlockedBy: [],
	ownerType: 'corporate',
	effects
});
const civic = (key: string, name: string) => ({ key, name, civicType: 'corporate' }) as Civic;

// shaped like 4.5.2 building_private_mining_consortium
const mining = building('mining', [
	eff('planet', 'planet_miners_trade_produces_add', 0.5),
	eff('planet', 'planet_miners_trade_produces_add', 0.5, 'civic_private_prospectors'),
	eff(
		'planet',
		'planet_crime_floor_add',
		10,
		null,
		'branch_office_owner = is_criminal_syndicate = yes'
	),
	eff('country', 'job_capital_trader_add', 200, 'civic_private_prospectors'),
	eff('country', 'job_capital_trader_add', 200, 'civic_privatized_exploration')
]);

describe('splitEffects', () => {
	it('sorts effects by where they go and what they need', () => {
		const s = splitEffects(mining);
		expect(s.colony).toHaveLength(1);
		expect(s.owner).toHaveLength(0);
		expect(s.byCivic).toHaveLength(3);
		expect(s.other.map((e) => e.modifier.key)).toEqual(['planet_crime_floor_add']);
	});
});

describe('civicBoosts', () => {
	it('lists each known civic with the buildings it adds to, by name', () => {
		const boosts = civicBoosts(
			[mining],
			[civic('civic_private_prospectors', 'Private Prospectors')]
		);
		expect(boosts.map((b) => b.civic.key)).toEqual(['civic_private_prospectors']);
		expect(boosts[0].buildings[0].effects.map((e) => e.scope)).toEqual(['planet', 'country']);
	});
});

describe('jobCount and conditionText', () => {
	it('counts jobs per 100 workforce', () => {
		expect(jobCount(eff('country', 'job_capital_trader_add', 200))).toBe(2);
		expect(jobCount(eff('planet', 'planet_crime_floor_add', 10))).toBeNull();
	});
	it('reads a gate', () => {
		expect(conditionText('branch_office_owner = is_criminal_syndicate = yes')).toBe(
			'owner: is criminal syndicate'
		);
		expect(conditionText('exists = planet.owner planet.owner = is_gestalt = no')).toBe(
			'colony owner: is gestalt = no'
		);
	});
});

describe('buildingJobs', () => {
	const labelled = (key: string, label: string): OwnedBuildingEffect => ({
		...eff('planet', key, 100),
		modifier: { key, value: 100, label, positiveIsGood: true }
	});
	const b = {
		...building('mining', [
			labelled('planet_miners_trade_produces_add', 'Trade Produced per 100 Miners'),
			labelled('job_capital_trader_add', 'Capital Trader Jobs'),
			labelled('planet_doctors_trade_produces_add', 'Trade Produced per 100 Medical Workers'),
			labelled('planet_crime_floor_add', 'Crime')
		]),
		jobs: [{ job: 'miner', name: 'Miner', amount: 200, resources: [] }]
	} as OwnedBuilding;
	it('names the jobs it gives and the ones it adds to, each once', () => {
		expect(buildingJobs(b)).toEqual([
			{ name: 'Miner', adds: true, boosts: true },
			{ name: 'Capital Trader', adds: true, boosts: false },
			{ name: 'Medical Workers', adds: false, boosts: true } // no singular to match
		]);
	});
	it('lists the filter choices sorted', () => {
		expect(jobNames([b])).toEqual(['Capital Trader', 'Medical Workers', 'Miner']);
	});
});
