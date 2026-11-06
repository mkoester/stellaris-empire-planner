import { describe, it, expect } from 'vitest';
import type { Civic, OwnedBuilding, OwnedBuildingEffect } from '#lib/server/db/index.ts';
import {
	access,
	boostingCivics,
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
	effects,
	ownerTrigger: null,
	hostTrigger: null,
	allow: null,
	techs: []
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

describe('access', () => {
	const leaf = (l: string, value: string) => ({ leaf: l, value });
	const names = { origin_toxic_knights: 'Toxic Knights' };
	it('every MegaCorp, a Criminal Syndicate too, without an owner condition', () => {
		expect(access(building('security', []), names)).toEqual({ kind: 'everyone', needs: [] });
	});
	it('every MegaCorp but an origin, with a tech and pops', () => {
		const b = {
			...building('megaplex', []),
			ownerTrigger: {
				op: 'and' as const,
				args: [
					leaf('is_legit_or_legal_criminal', 'yes'),
					{ op: 'not' as const, args: [leaf('has_origin', 'origin_toxic_knights')] }
				]
			},
			allow: { leaf: 'pop_amount', cmp: '>=', value: '2500' },
			techs: [{ key: 'tech_executive_retreat', name: 'Executive Retreat' }]
		};
		expect(access(b, names)).toEqual({
			kind: 'legit',
			needs: ['not Toxic Knights', 'Executive Retreat', '25+ pops']
		});
	});
	it('a Criminal Syndicate without a tie to the host', () => {
		const b = { ...building('pirates', []), ownerTrigger: leaf('is_illegal_criminal', 'yes') };
		expect(access(b, names).kind).toBe('criminal');
	});
	it('a civic unlocks it: the civic is not repeated under needs', () => {
		const b = {
			...building('clinic', []),
			unlockedBy: ['civic_twisted_experimenters_corporate'],
			ownerTrigger: leaf('has_valid_civic', 'civic_twisted_experimenters_corporate')
		};
		expect(access(b, names)).toEqual({ kind: 'civic', needs: [] });
	});
});

describe('boostingCivics', () => {
	it('reads the civics a gate names for the owner, not the host', () => {
		const b = building('food', [
			eff(
				'planet',
				'planet_farmers_trade_produces_add',
				0.1,
				null,
				'branch_office_owner = OR = has_valid_civic = civic_corporate_machine_anglers civic_corporate_anglers'
			),
			eff(
				'planet',
				'planet_crime_add',
				5,
				null,
				'owner = has_valid_civic = civic_dystopian_society branch_office_owner = is_illegal_criminal = yes'
			)
		]);
		expect(boostingCivics(b)).toEqual([
			'civic_corporate_machine_anglers',
			'civic_corporate_anglers'
		]);
	});
	it('names each civic that adds to a building once', () => {
		expect(boostingCivics(mining)).toEqual([
			'civic_private_prospectors',
			'civic_privatized_exploration'
		]);
	});
});
