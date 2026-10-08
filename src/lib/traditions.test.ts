import { describe, it, expect } from 'vitest';
import type {
	Agenda,
	AscensionPerk,
	ConditionalModifier,
	Edict,
	Swap,
	Tradition,
	TraditionTree,
	Trigger
} from '$lib/server/db';
import {
	effective,
	isAscensionTree,
	matches,
	profileAxes,
	searchText,
	traditionCost,
	treeColumns,
	treeDescription,
	treeLinks,
	unlocksFor,
	edictTip,
	agendaTip,
	durationText,
	linkify
} from '$lib/traditions';
import { ANY_PROFILE, type EmpireProfile } from '$lib/triggers';

const L = (leaf: string, value = 'yes'): Trigger => ({ leaf, value });
const mod = (
	key: string,
	value: number,
	potential: Trigger | null = null
): ConditionalModifier => ({
	key,
	value,
	label: key,
	positiveIsGood: true,
	potential
});
const swap = (id: string, trigger: Trigger, extra: Partial<Swap> = {}): Swap => ({
	id,
	locKey: null,
	name: id,
	description: null,
	trigger,
	inheritEffects: false,
	weight: 1,
	tooltip: null,
	modifiers: [],
	...extra
});
const trad = (key: string, requires: string[] = [], extra: Partial<Tradition> = {}): Tradition => ({
	key,
	role: 'normal',
	name: key,
	description: `${key} desc`,
	possible: null,
	requires,
	unlocksAgenda: null,
	tooltip: null,
	modifiers: [],
	swaps: [],
	...extra
});
const tree = (traditions: Tradition[], extra: Partial<TraditionTree> = {}): TraditionTree => ({
	key: 'tradition_x',
	name: 'X',
	potential: null,
	requiredDlc: null,
	descs: [],
	adopt: trad('tr_x_adopt', [], { role: 'adopt' }),
	finish: trad('tr_x_finish', [], { role: 'finish' }),
	traditions,
	...extra
});

const hive: EmpireProfile = { authority: 'hive', flags: [] };

describe('treeColumns', () => {
	it('builds branches from prerequisites (tree_12_11)', () => {
		const ts = [trad('a'), trad('b'), trad('a1', ['a']), trad('a2', ['a']), trad('b1', ['b'])];
		expect(treeColumns(ts).map((col) => col.map((row) => row.map((t) => t.key)))).toEqual([
			[['a'], ['a1', 'a2']],
			[['b'], ['b1']]
		]);
	});

	it('stacks a chain and ignores prerequisites outside the tree', () => {
		const ts = [trad('a', ['other_tree']), trad('b', ['a']), trad('c', ['b'])];
		expect(treeColumns(ts).map((col) => col.map((row) => row.map((t) => t.key)))).toEqual([
			[['a'], ['b'], ['c']]
		]);
	});
});

describe('effective', () => {
	const base = trad('t', [], {
		modifiers: [
			mod('m_all', 1),
			mod('m_nomad', 1, L('is_nomadic')),
			mod('m_settled', 1, L('is_nomadic', 'no'))
		],
		tooltip: 'base tip',
		swaps: [
			swap('hive', L('is_hive_empire'), { inheritEffects: true }),
			swap('machine', L('is_machine_empire'), { modifiers: [mod('m_machine', 2)] })
		]
	});

	it('keeps the owner effects for an inheriting swap', () => {
		const e = effective(base, hive);
		expect(e.name).toBe('hive');
		expect(e.description).toBe('t desc'); // swap has none → owner's
		expect(e.tooltip).toBe('base tip');
		expect(e.modifiers.map((m) => [m.mod.key, m.state])).toEqual([
			['m_all', true],
			['m_settled', true]
		]);
	});

	it('uses the swap effects otherwise', () => {
		const e = effective(base, { authority: 'machine', flags: [] });
		expect(e.modifiers.map((m) => m.mod.key)).toEqual(['m_machine']);
		expect(e.tooltip).toBe(null);
	});

	it('shows the base with open variants for the empty profile', () => {
		const e = effective(base, ANY_PROFILE);
		expect(e.swap).toBe(null);
		expect(e.otherSwaps.map((s) => s.id)).toEqual(['hive', 'machine']);
		expect(e.modifiers.map((m) => m.state)).toEqual([true, null, null]);
	});
});

describe('treeDescription', () => {
	const t = tree([], {
		descs: [
			{ trigger: L('is_regular_empire'), description: 'regular' },
			{ trigger: L('is_hive_empire'), description: 'hive' }
		]
	});
	it('picks the first variant that may apply', () => {
		expect(treeDescription(t, hive)).toBe('hive');
		expect(treeDescription(t, ANY_PROFILE)).toBe('regular');
	});
});

describe('profileAxes', () => {
	it('collects only the axes the tree branches on', () => {
		const t = tree([
			trad('a', [], {
				swaps: [swap('s', { op: 'and', args: [L('is_hive_empire'), L('is_nomadic')] })]
			})
		]);
		expect(profileAxes(t)).toEqual({
			authorities: ['regular', 'hive', 'machine'],
			flags: ['nomadic']
		});
		expect(profileAxes(tree([trad('a')]))).toEqual({ authorities: [], flags: [] });
	});
});

describe('isAscensionTree', () => {
	it('detects an ascension-path test in the potential', () => {
		const not = (a: Trigger): Trigger => ({ op: 'not', args: [a] });
		expect(isAscensionTree(tree([], { potential: not(L('has_genetic_ascension')) }))).toBe(true);
		expect(isAscensionTree(tree([], { potential: L('is_gestalt', 'no') }))).toBe(false);
	});
});

describe('treeLinks', () => {
	it('links the unlocking perk and the perks needing the finisher', () => {
		const t = tree([], {
			adopt: trad('tr_x_adopt', [], { possible: L('has_ascension_perk', 'ap_path') })
		});
		const perk = (key: string, possible: Trigger | null): AscensionPerk => ({
			key,
			name: key,
			description: null,
			isPath: false,
			potential: null,
			possible,
			requiredDlc: null,
			tooltip: null,
			modifiers: [],
			swaps: []
		});
		const links = treeLinks(
			[t],
			[perk('ap_a', L('has_tradition', 'tr_x_finish')), perk('ap_b', null)]
		);
		expect(links.unlockedBy.tradition_x).toEqual(['ap_path']);
		expect(links.unlocksPerks.tradition_x).toEqual(['ap_a']);
	});
});

describe('traditionCost', () => {
	const d = {
		TRADITION_COST_AMOUNTS: 300,
		TRADITION_COST_TRADITION: 8,
		TRADITION_COST_TRADITION_EXP: 1.8,
		EMPIRE_SIZE_BASE: 100,
		EMPIRE_SIZE_TRADITION_COST_PENALTY: 0.002
	};
	it('follows the defines formula', () => {
		expect(traditionCost(0, 50, 0, 1, d)).toBe(300);
		expect(traditionCost(10, 100, 0, 1, d)).toBeCloseTo(300 + 80 ** 1.8, 6);
		// 200 size → +20%, halved by a −50% empire size effect, at 2× cost setting
		expect(traditionCost(0, 200, 0.5, 2, d)).toBeCloseTo(300 * 1.1 * 2, 6);
	});
});

describe('search', () => {
	it('covers names, variants and modifier labels', () => {
		const t = trad('Reach', [], {
			modifiers: [mod('Pop Growth', 1)],
			swaps: [swap('Arkship Armada', L('is_nomadic'))]
		});
		const text = searchText(t);
		expect(matches(text, 'arkship')).toBe(true);
		expect(matches(text, 'pop growth')).toBe(true);
		expect(matches(text, 'pop alloys')).toBe(false);
	});
});

describe('edicts & agendas', () => {
	const edict = (key: string, unlockedBy: string[], potential: Trigger | null = null): Edict => ({
		key,
		name: key,
		description: 'flavour',
		length: -1,
		cost: { cost: { unity: 10 }, upkeep: { sr_zro: 0.5 } },
		potential,
		unlockedBy,
		tooltip: null,
		modifiers: [mod('survey_speed_mult', 0.25)]
	});
	const agenda: Agenda = {
		key: 'agenda_x',
		name: 'Agenda X',
		description: null,
		cost: 7000,
		finishDays: 3600,
		potential: null,
		unlockedBy: ['tr_a'],
		effectTooltip: null,
		modifiers: [mod('speed_mult', 0.25)],
		finishModifiers: [mod('speed_mult', 0.5)]
	};

	it('links by tradition key or swap name, filtered by the profile', () => {
		const t = trad('tr_a', [], {
			swaps: [swap('tr_a#0', L('is_hive_empire'), { locKey: 'tr_a_hive' })]
		});
		const edicts = [
			edict('e_regular', ['tr_a'], L('is_gestalt', 'no')),
			edict('e_hive', ['tr_a_hive'], L('is_hive_empire')),
			edict('e_other', ['tr_b'])
		];
		expect(unlocksFor(t, edicts, [agenda], ANY_PROFILE).map((u) => u.key)).toEqual([
			'e_regular',
			'e_hive',
			'agenda_x'
		]);
		expect(unlocksFor(t, edicts, [], hive).map((u) => u.key)).toEqual(['e_hive']);
		const twins = [
			{ ...edict('e1', ['tr_a']), name: 'Subsidies' },
			{ ...edict('e2', ['tr_a']), name: 'Subsidies' }
		];
		const merged = unlocksFor(t, twins, [], ANY_PROFILE);
		expect(merged.map((u) => u.key)).toEqual(['e1']);
		expect(merged[0].tip).toContain('— or, depending on empire type —');
	});

	it('builds tooltip text', () => {
		expect(edictTip(edict('Map', []))).toBe(
			'Edict: Map\nCost 10 Unity · upkeep 0.5 Zro/month · lasts until cancelled\n+25% survey_speed_mult\n\nflavour'
		);
		expect(agendaTip(agenda)).toBe(
			'Council agenda: Agenda X\nLaunch at 7,000 agenda progress\nWhile preparing:\n  +25% speed_mult\nAfter launch (10 years):\n  +50% speed_mult'
		);
		expect(durationText(720)).toBe('2 years');
		expect(durationText(30)).toBe('30 days');
	});

	it('linkify marks mentions, longest name first', () => {
		expect(linkify('Unlocks Edict: Map the Stars.', ['Map', 'Map the Stars'])).toEqual([
			{ text: 'Unlocks Edict: ', index: null },
			{ text: 'Map the Stars', index: 1 },
			{ text: '.', index: null }
		]);
		expect(linkify('none', [])).toEqual([{ text: 'none', index: null }]);
	});
});
