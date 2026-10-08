import { describe, it, expect } from 'vitest';
import type { Trigger } from '$lib/server/db';
import {
	ANY_PROFILE,
	evaluate,
	flagAllowed,
	perkTier,
	pickSwap,
	positiveLeaves,
	profileFromDraft,
	requirementLines,
	toggleFlag,
	triggerText,
	withAuthority,
	type EmpireProfile
} from '$lib/triggers';

const L = (leaf: string, value = 'yes', cmp?: string): Trigger =>
	cmp ? { leaf, value, cmp } : { leaf, value };
const and = (...args: Trigger[]): Trigger => ({ op: 'and', args });
const or = (...args: Trigger[]): Trigger => ({ op: 'or', args });
const not = (a: Trigger): Trigger => ({ op: 'not', args: [a] });

const hive: EmpireProfile = { authority: 'hive', flags: [] };
const regular: EmpireProfile = { authority: 'regular', flags: [] };
const nomadHive: EmpireProfile = { authority: 'hive', flags: ['nomadic'] };

describe('evaluate', () => {
	it('maps authority leaves', () => {
		expect(evaluate(L('is_gestalt', 'no'), hive)).toBe(false);
		expect(evaluate(L('is_gestalt'), hive)).toBe(true);
		expect(evaluate(L('is_regular_empire'), regular)).toBe(true);
		expect(evaluate(L('is_machine_empire'), hive)).toBe(false);
	});

	it('is unknown for the empty profile', () => {
		expect(evaluate(L('is_gestalt'), ANY_PROFILE)).toBe(null);
		expect(evaluate(L('is_nomadic'), ANY_PROFILE)).toBe(null);
	});

	it('treats unset flags as false once the profile is active', () => {
		expect(evaluate(L('is_nomadic'), hive)).toBe(false);
		expect(evaluate(L('is_nomadic'), nomadHive)).toBe(true);
	});

	it('assumes all DLC', () => {
		expect(evaluate(not(L('host_has_dlc', 'BioGenesis')), regular)).toBe(false);
	});

	it('uses Kleene logic: false dominates and, true dominates or', () => {
		const flag = L('has_country_flag', 'x');
		expect(evaluate(and(flag, L('is_gestalt')), regular)).toBe(false);
		expect(evaluate(and(flag, L('is_gestalt')), hive)).toBe(null);
		expect(evaluate(or(flag, L('is_gestalt')), hive)).toBe(true);
		expect(evaluate(or(flag, L('is_gestalt')), regular)).toBe(null);
		expect(evaluate(null, regular)).toBe(true);
	});

	it('knows ethics/civics/origin only from a planned empire', () => {
		const c = L('has_valid_civic', 'civic_x');
		expect(evaluate(c, regular)).toBe(null);
		expect(evaluate(c, regular, { assumeAbsent: true })).toBe(false);
		expect(evaluate(c, { ...regular, civics: ['civic_x'] })).toBe(true);
	});
});

describe('perkTier', () => {
	// Mind Over Matter: 2 perks normally, 3 for synthetic empires.
	const mom = or(
		and(L('is_synthetic_empire', 'no'), L('num_ascension_perks', '1', '>')),
		and(not(L('is_synthetic_empire', 'no')), L('num_ascension_perks', '2', '>'))
	);
	it('takes the lowest count that is not ruled out', () => {
		expect(perkTier(mom, regular)).toBe(2);
		expect(perkTier(L('num_ascension_perks', '2', '>'), regular)).toBe(3);
		expect(perkTier(null, regular)).toBe(0);
	});

	it('ignores an origin exception unless the origin is known', () => {
		// Biomorphosis: Clone Army may take it early.
		const t = or(
			and(not(L('has_origin', 'origin_clone_army')), L('num_ascension_perks', '1', '>')),
			L('has_origin', 'origin_clone_army')
		);
		expect(perkTier(t, regular)).toBe(2);
		expect(perkTier(t, { ...regular, origin: 'origin_clone_army' })).toBe(0);
	});

	it('is null when the profile can never take it', () => {
		expect(perkTier(L('is_gestalt'), regular)).toBe(null);
	});
});

describe('pickSwap', () => {
	const swaps = [
		{ id: 'nomad', trigger: L('is_nomadic'), weight: 1 },
		{ id: 'hive', trigger: and(L('is_hive_empire'), L('is_nomadic', 'no')), weight: 1 },
		{ id: 'hive_nomad', trigger: and(L('is_hive_empire'), L('is_nomadic')), weight: 2 }
	];
	it('picks the definitely-true swap with the highest weight', () => {
		expect(pickSwap(swaps, hive)?.id).toBe('hive');
		expect(pickSwap(swaps, nomadHive)?.id).toBe('hive_nomad');
		expect(pickSwap(swaps, regular)).toBe(null);
		expect(pickSwap(swaps, ANY_PROFILE)).toBe(null);
	});
});

describe('profile editing', () => {
	it('Wilderness forces Hive and drops Nomadic', () => {
		const p = toggleFlag({ authority: 'regular', flags: ['nomadic'] }, 'wilderness');
		expect(p).toEqual({ authority: 'hive', flags: ['wilderness'] });
	});

	it('changing authority drops flags limited to another one', () => {
		expect(
			withAuthority({ authority: 'regular', flags: ['megacorp', 'homicidal'] }, 'machine')
		).toEqual({ authority: 'machine', flags: ['homicidal'] });
	});

	it('flagAllowed respects the authority', () => {
		expect(flagAllowed(hive, 'megacorp')).toBe(false);
		expect(flagAllowed(ANY_PROFILE, 'megacorp')).toBe(true);
	});
});

describe('profileFromDraft', () => {
	const draft = {
		authority: 'auth_corporate',
		ethics: ['ethic_xenophobe'],
		civics: ['civic_fanatic_purifiers'],
		origin: 'origin_default_nomads',
		speciesClass: 'MACHINE'
	};
	it('derives authority and flags', () => {
		const p = profileFromDraft(draft, { MACHINE: 'MACHINE' }, ['origin_default_nomads']);
		expect(p.authority).toBe('regular');
		expect(p.flags.sort()).toEqual(['homicidal', 'individualMachine', 'megacorp', 'nomadic']);
		expect(p.origin).toBe('origin_default_nomads');
	});

	it('maps gestalt authorities', () => {
		const base = { ...draft, civics: [], origin: 'origin_wilderness' };
		const h = profileFromDraft({ ...base, authority: 'auth_hive_mind' }, {}, []);
		expect(h).toMatchObject({ authority: 'hive', flags: ['wilderness'] });
		const m = profileFromDraft(
			{ ...base, authority: 'auth_machine_intelligence', origin: null },
			{ MACHINE: 'MACHINE' },
			[]
		);
		expect(m).toMatchObject({ authority: 'machine', flags: [] });
	});
});

describe('display', () => {
	const names = { civic_x: 'Civic X', ap_a: 'Perk A' };
	it('renders leaves and nesting', () => {
		expect(
			triggerText(
				and(L('is_gestalt', 'no'), or(L('has_valid_civic', 'civic_x'), L('is_nomadic'))),
				names
			)
		).toBe('not Gestalt and (Civic X or Nomadic)');
		expect(triggerText(L('num_ascension_perks', '2', '>'), names)).toBe('3+ ascension perks');
		expect(triggerText(L('host_has_dlc', 'Nemesis'), names)).toBe('Nemesis DLC');
		expect(triggerText(L('has_technology', 'tech_mega_engineering'), names)).toBe(
			'Mega Engineering (tech)'
		);
	});

	it('splits requirements, expanding not-or into exclusions', () => {
		const t = and(
			L('is_gestalt', 'no'),
			L('num_ascension_perks', '1', '>'),
			not(or(L('has_ascension_perk', 'ap_a'), L('is_nomadic')))
		);
		const lines = requirementLines(t, names, regular, ['num_ascension_perks']);
		expect(lines.map((l) => [l.type, l.text, l.state])).toEqual([
			['needs', 'not Gestalt', true],
			['excludes', 'Perk A', null],
			['excludes', 'Nomadic', true]
		]);
	});

	it('positiveLeaves skips negations', () => {
		expect(
			positiveLeaves(and(L('has_tradition', 'a'), not(L('has_tradition', 'b'))), 'has_tradition')
		).toEqual(['a']);
	});
});
