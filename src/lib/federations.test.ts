import { describe, it, expect } from 'vitest';
import type { FederationPerk, FederationType, Swap, Trigger } from '$lib/server/db';
import { federationSearchText, federationsFor, federationTip, perkLines } from '$lib/federations';
import { unlocksFor } from '$lib/traditions';
import {
	ANY_PROFILE,
	evaluate,
	leafText,
	triggerText,
	withAllDlc,
	type EmpireProfile
} from '$lib/triggers';

const perk = (key: string, extra: Partial<FederationPerk> = {}): FederationPerk => ({
	key,
	name: key,
	description: null,
	effect: null,
	modifiers: [],
	...extra
});

const fed = (key: string, extra: Partial<FederationType> = {}): FederationType => ({
	key,
	name: key,
	description: null,
	baseIntel: null,
	potential: { leaf: 'host_has_dlc', value: 'Federations' },
	allow: null,
	unlockedBy: [],
	excludedBy: [],
	levels: [],
	...extra
});

const passive = perk('mil_passive', {
	effect: 'Ships start with experience.',
	modifiers: [
		{
			key: 'ship_starting_experience_add',
			value: 100,
			label: 'Ship Starting Experience',
			positiveIsGood: true,
			potential: null,
			scope: 'members'
		}
	]
});
const martial = fed('military_federation', {
	name: 'Martial Alliance',
	description: 'Flavour.',
	unlockedBy: ['ethic_militarist', 'ethic_fanatic_militarist', 'tr_unyielding_federations_finish'],
	levels: [{ level: 1, experience: 1200, perks: [passive] }]
});
const trade = fed('trade_federation', {
	name: 'Trade League',
	unlockedBy: ['civic_merchant_guilds'],
	excludedBy: ['civic_barbaric_despoilers']
});

describe('federation helpers', () => {
	it('perkLines: scoped modifiers, then the effect text', () => {
		expect(perkLines(passive)).toEqual([
			'Members: +100 Ship Starting Experience',
			'Ships start with experience.'
		]);
	});

	it('federationTip: name, passive perk, description', () => {
		expect(federationTip(martial)).toBe(
			'Federation type: Martial Alliance\nFrom the start:\n  Members: +100 Ship Starting Experience\n  Ships start with experience.\n\nFlavour.'
		);
		expect(federationTip(trade)).toBe('Federation type: Trade League');
	});

	it('federationSearchText covers perk names and effect lines', () => {
		const text = federationSearchText(martial);
		expect(text).toContain('martial alliance');
		expect(text).toContain('mil_passive');
		expect(text).toContain('ship starting experience');
		expect(federationSearchText(trade)).not.toContain('experience');
	});

	it('federationsFor: forms / blocks by key', () => {
		const types = [martial, trade];
		expect(federationsFor('ethic_fanatic_militarist', types).forms).toEqual([martial]);
		expect(federationsFor('civic_barbaric_despoilers', types)).toEqual({
			forms: [],
			blocks: [trade]
		});
		expect(federationsFor('civic_other', types)).toEqual({ forms: [], blocks: [] });
	});

	it('unlocksFor links a federation through the tradition swap name', () => {
		const swap: Swap = {
			id: 'tr_unyielding_finish#0',
			locKey: 'tr_unyielding_federations_finish',
			name: null,
			description: null,
			trigger: null,
			inheritEffects: false,
			weight: 1,
			tooltip: null,
			modifiers: []
		};
		const u = unlocksFor({ key: 'tr_unyielding_finish', swaps: [swap] }, [], [], ANY_PROFILE, [
			martial,
			trade
		]);
		expect(u.map((x) => [x.kind, x.key, x.name])).toEqual([
			['federation', 'military_federation', 'Martial Alliance']
		]);
		expect(u[0].tip).toContain('From the start:');
		// Without the federation list, nothing changes for existing callers.
		expect(unlocksFor({ key: 'tr_unyielding_finish', swaps: [swap] }, [], [], ANY_PROFILE)).toEqual(
			[]
		);
	});
});

describe('scripted ethic leaves', () => {
	const L = (leaf: string, value = 'yes'): Trigger => ({ leaf, value });
	const withEthics = (ethics: string[]): EmpireProfile => ({ ...ANY_PROFILE, ethics });

	it('match the plain or fanatic ethic', () => {
		expect(evaluate(L('is_militarist'), withEthics(['ethic_fanatic_militarist']))).toBe(true);
		expect(evaluate(L('is_militarist'), withEthics(['ethic_militarist']))).toBe(true);
		expect(evaluate(L('is_militarist'), withEthics(['ethic_pacifist']))).toBe(false);
		expect(evaluate(L('is_militarist', 'no'), withEthics(['ethic_pacifist']))).toBe(true);
		expect(evaluate(L('is_militarist'), ANY_PROFILE)).toBe(null);
	});

	it('read as the ethic name', () => {
		expect(leafText({ leaf: 'is_authoritarian', value: 'yes' }, {})).toBe('Authoritarian');
	});
});

describe('withAllDlc', () => {
	const L = (leaf: string, value = 'yes'): Trigger => ({ leaf, value });
	const dlc = L('host_has_dlc', 'Megacorp');

	it('drops the branch an all-DLC game never takes (Trade League)', () => {
		const t: Trigger = {
			op: 'or',
			args: [
				{
					op: 'and',
					args: [dlc, { op: 'or', args: [L('is_megacorp'), L('has_civic', 'guilds')] }]
				},
				{ op: 'and', args: [{ op: 'not', args: [dlc] }, L('has_civic', 'dominion')] }
			]
		};
		expect(withAllDlc(t)).toEqual({ op: 'or', args: [L('is_megacorp'), L('has_civic', 'guilds')] });
	});

	it('settles pure DLC checks and keeps the rest', () => {
		expect(withAllDlc(null)).toBe(true);
		expect(withAllDlc(dlc)).toBe(true);
		expect(withAllDlc({ op: 'not', args: [dlc] })).toBe(false);
		expect(withAllDlc({ op: 'and', args: [dlc, L('is_militarist')] })).toEqual(L('is_militarist'));
		expect(withAllDlc({ op: 'not', args: [L('x')] })).toEqual({ op: 'not', args: [L('x')] });
	});

	it('triggerText shows identical alternatives once', () => {
		const t: Trigger = { op: 'or', args: [L('has_tradition', 'a'), L('has_tradition', 'b')] };
		expect(triggerText(t, { a: 'Domination finished', b: 'Domination finished' })).toBe(
			'Domination finished'
		);
		expect(
			triggerText({ op: 'or', args: [L('is_authoritarian'), t] }, { a: 'Dom', b: 'Dom' })
		).toBe('Authoritarian or Dom');
	});
});
