import { describe, it, expect } from 'vitest';
import type {
	Modifier,
	Precursor,
	PrecursorReward,
	RelicModifier,
	DepositResource,
	PlanetDeposit,
	PrecursorPlanet
} from '$lib/server/db';
import {
	conditionApplies,
	applicableTypes,
	conditionLabel,
	typesLabel,
	mergeRelicPassives,
	variantApplies,
	formatValue,
	valueColor,
	modLabel,
	variantLabel,
	resourceLabel,
	shownPlanets,
	isRelevant,
	isTerraformable,
	depositChips,
	megaLabel,
	relicResourceLabel,
	cooldownLabel,
	dlcBadge,
	groupByDlc,
	ALL_TYPES,
	type EmpireType
} from './precursors';

// ── fixtures ────────────────────────────────────────────────────────────────
const mod = (key: string, value: number, o: Partial<Modifier> = {}): Modifier => ({
	key,
	value,
	label: null,
	positiveIsGood: true,
	...o
});
const res = (resource: string, amount: number, kind = 'produces'): DepositResource => ({
	kind,
	resource,
	amount
});
const dep = (o: Partial<PlanetDeposit> = {}): PlanetDeposit => ({
	depositKey: 'd_x',
	name: null,
	isBlocker: false,
	resources: [],
	...o
});
const planet = (o: Partial<PrecursorPlanet> = {}): PrecursorPlanet => ({
	id: 's#0',
	name: null,
	planetClass: null,
	planetClassLabel: null,
	size: null,
	isMoon: false,
	isHomeworld: false,
	deposits: [],
	modifiers: [],
	...o
});

// ── empire-type applies logic ───────────────────────────────────────────────
describe('conditionApplies / applicableTypes', () => {
	it('null condition applies to every empire type', () => {
		expect(applicableTypes(null)).toEqual(ALL_TYPES);
	});

	it('Baol AND branch (machine=no, wilderness=no) → regular & hive', () => {
		expect(applicableTypes('is_machine_empire = no, is_wilderness_empire = no')).toEqual([
			'regular',
			'hive'
		]);
	});

	it('Baol OR branch (machine OR wilderness) → machine & wilderness', () => {
		expect(applicableTypes('(is_machine_empire = yes OR is_wilderness_empire = yes)')).toEqual([
			'machine',
			'wilderness'
		]);
	});

	it('Cryo Core is_wilderness_empire = no → all but wilderness', () => {
		expect(applicableTypes('is_wilderness_empire = no')).toEqual(['regular', 'machine', 'hive']);
	});

	it('Cryo Core is_wilderness_empire = yes → wilderness only', () => {
		expect(applicableTypes('is_wilderness_empire = yes')).toEqual(['wilderness']);
	});

	it('an unrecognised clause does not exclude any type', () => {
		expect(conditionApplies('has_country_flag = foo', 'machine')).toBe(true);
	});
});

describe('variantApplies', () => {
	const apply = (variant: string) => ALL_TYPES.filter((t) => variantApplies(variant, t));

	it('default reward applies to everyone', () => {
		expect(apply('default')).toEqual(ALL_TYPES);
	});
	it('suppressed/public (regular-empire choice) → regular & wilderness', () => {
		expect(apply('suppressed')).toEqual(['regular', 'wilderness']);
		expect(apply('public')).toEqual(['regular', 'wilderness']);
	});
	it('machine / hive variants are empire-type specific', () => {
		expect(apply('machine')).toEqual(['machine']);
		expect(apply('hive')).toEqual(['hive']);
	});
	it('hive_machine (Inetian) → hive & machine', () => {
		expect(apply('hive_machine')).toEqual(['machine', 'hive']);
	});
	it('unknown variant falls back to applies-to-all', () => {
		expect(apply('something_new')).toEqual(ALL_TYPES);
	});
});

describe('mergeRelicPassives', () => {
	// The Baol relic: +10% pop growth via a non-machine/non-wilderness branch AND a
	// machine/wilderness branch; +10% society research only on the latter.
	const rm = (key: string, value: number, condition: string | null): RelicModifier => ({
		key,
		value,
		label: key,
		positiveIsGood: true,
		condition
	});
	const baol: RelicModifier[] = [
		rm('logistic_growth_mult', 0.1, 'is_machine_empire = no, is_wilderness_empire = no'),
		rm('logistic_growth_mult', 0.1, '(is_machine_empire = yes OR is_wilderness_empire = yes)'),
		rm(
			'country_society_research_produces_mult',
			0.1,
			'(is_machine_empire = yes OR is_wilderness_empire = yes)'
		)
	];

	it('merges same modifier+value across branches and unions their types', () => {
		const merged = mergeRelicPassives(baol);
		expect(merged.map((m) => m.key)).toEqual([
			'logistic_growth_mult',
			'country_society_research_produces_mult'
		]);
		// pop growth now spans every type → effectively unconditional (no note)
		expect(typesLabel(merged[0].types)).toBeNull();
		// society research stays machine/wilderness only
		expect(typesLabel(merged[1].types)).toBe('machine / wilderness');
	});

	it('does not merge a modifier that appears with different values', () => {
		const merged = mergeRelicPassives([rm('x', 0.1, null), rm('x', 0.2, null)]);
		expect(merged).toHaveLength(2);
	});
});

describe('typesLabel', () => {
	it('is null for the full set, "non-X" for all-but-one, else a list', () => {
		expect(typesLabel(['regular', 'machine', 'hive', 'wilderness'])).toBeNull();
		expect(typesLabel(['regular', 'machine', 'hive'])).toBe('non-wilderness');
		expect(typesLabel(['machine', 'wilderness'])).toBe('machine / wilderness');
	});
});

describe('conditionLabel', () => {
	it('returns null when it applies to every type', () => {
		expect(conditionLabel(null)).toBeNull();
	});
	it('uses "non-X" when exactly one type is excluded', () => {
		expect(conditionLabel('is_wilderness_empire = no')).toBe('non-wilderness');
	});
	it('lists the types otherwise', () => {
		expect(conditionLabel('is_machine_empire = no, is_wilderness_empire = no')).toBe(
			'regular / hive'
		);
		expect(conditionLabel('(is_machine_empire = yes OR is_wilderness_empire = yes)')).toBe(
			'machine / wilderness'
		);
	});
});

// ── modifier formatting ─────────────────────────────────────────────────────
describe('formatValue', () => {
	it('renders _mult modifiers as a percentage', () => {
		expect(formatValue(mod('country_unity_produces_mult', 0.1))).toBe('+10%');
		expect(formatValue(mod('pop_amenities_usage_mult', -0.1))).toBe('-10%');
	});
	it('renders _add modifiers as a number (integer or 2dp)', () => {
		expect(formatValue(mod('leader_lifespan_add', 20))).toBe('+20');
		expect(formatValue(mod('some_add', 1.5))).toBe('+1.5');
	});
});

describe('valueColor', () => {
	it('positive + positiveIsGood → emerald', () => {
		expect(valueColor(mod('x', 0.1, { positiveIsGood: true }))).toBe('text-emerald-400');
	});
	it('positive value of an inverted modifier → red', () => {
		expect(valueColor(mod('x', 0.1, { positiveIsGood: false }))).toBe('text-red-400');
	});
	it('negative value of an inverted modifier (a reduction) → emerald', () => {
		expect(valueColor(mod('x', -0.1, { positiveIsGood: false }))).toBe('text-emerald-400');
	});
});

describe('modLabel', () => {
	it('uses the label when present', () => {
		expect(modLabel(mod('x', 1, { label: 'Monthly Unity' }))).toBe('Monthly Unity');
	});
	it('strips unresolved [..] script tags', () => {
		expect(modLabel(mod('x', 1, { label: 'Eat [This.GetName] food' }))).toBe('Eat  food');
	});
	it('title-cases the key when no label', () => {
		expect(modLabel(mod('country_unity_produces_mult', 1))).toBe('Country Unity Produces Mult');
	});
});

describe('variantLabel', () => {
	const reward = (variant: string, name: string | null = null): PrecursorReward => ({
		staticModifier: 's',
		variant,
		name,
		modifiers: []
	});
	it('maps known variants to an empire-type descriptor', () => {
		expect(variantLabel(reward('machine'))).toBe('Machine empire');
		expect(variantLabel(reward('suppressed'))).toBe('Regular empire — research kept secret');
	});
	it('falls back to the reward name then the raw variant', () => {
		expect(variantLabel(reward('weird', 'Some Reward'))).toBe('Some Reward');
		expect(variantLabel(reward('weird', null))).toBe('weird');
	});
});

// ── deposits / planets ──────────────────────────────────────────────────────
describe('resourceLabel', () => {
	it('signs produced yields and tidies the resource name', () => {
		expect(resourceLabel(res('minerals', 10))).toBe('+10 Minerals');
		expect(resourceLabel(res('physics_research', 10))).toBe('+10 Physics');
	});
	it('does not sign non-produced kinds', () => {
		expect(resourceLabel(res('energy', 750, 'cost'))).toBe('750 Energy');
	});
});

describe('depositChips', () => {
	it('splits resources, collapses blockers by name with a count, keeps others', () => {
		const chips = depositChips([
			dep({ depositKey: 'd_minerals_10', resources: [res('minerals', 10)] }),
			dep({ depositKey: 'd_ruined_arcology', name: 'Ruined Arcology', isBlocker: true }),
			dep({ depositKey: 'd_ruined_arcology', name: 'Ruined Arcology', isBlocker: true }),
			dep({ depositKey: 'd_mystery', name: 'Mystery' })
		]);
		expect(chips.resources).toEqual(['+10 Minerals']);
		expect(chips.blockers).toEqual([{ name: 'Ruined Arcology', count: 2 }]);
		expect(chips.others).toEqual(['Mystery']);
	});
});

describe('shownPlanets', () => {
	it('drops bare stars and empty bodies, keeps anything with content', () => {
		const star = planet({ planetClass: 'star' });
		const empty = planet({ planetClass: 'pc_barren' });
		const world = planet({ planetClass: 'pc_relic', planetClassLabel: 'Relic World', size: 25 });
		expect(shownPlanets([star, empty, world])).toEqual([world]);
	});
});

describe('isRelevant', () => {
	it('is true for homeworlds', () => {
		expect(isRelevant(planet({ planetClass: 'pc_barren', isHomeworld: true }))).toBe(true);
	});
	it('is true for a resource deposit but not a blocker-only body', () => {
		expect(isRelevant(planet({ deposits: [dep({ resources: [res('minerals', 10)] })] }))).toBe(
			true
		);
		expect(
			isRelevant(planet({ planetClass: 'pc_asteroid', deposits: [dep({ isBlocker: true })] }))
		).toBe(false);
	});
	it('is true for habitable & terraform-candidate classes', () => {
		expect(isRelevant(planet({ planetClass: 'pc_continental' }))).toBe(true);
		expect(isRelevant(planet({ planetClass: 'pc_toxic' }))).toBe(true);
	});
	it('is false for a barren body with nothing notable', () => {
		expect(isRelevant(planet({ planetClass: 'pc_barren' }))).toBe(false);
	});
});

describe('isTerraformable', () => {
	it('flags toxic worlds only', () => {
		expect(isTerraformable(planet({ planetClass: 'pc_toxic' }))).toBe(true);
		expect(isTerraformable(planet({ planetClass: 'pc_continental' }))).toBe(false);
	});
});

describe('megaLabel', () => {
	it('adds a ×N count only when there is more than one', () => {
		expect(megaLabel({ type: 'hyper_relay_ruined', label: 'Ruined Hyper Relay', count: 1 })).toBe(
			'Ruined Hyper Relay'
		);
		expect(megaLabel({ type: 'ring_world_ruined', label: 'Ruined Ring Section', count: 4 })).toBe(
			'Ruined Ring Section ×4'
		);
	});
	it('falls back to the type when there is no label', () => {
		expect(megaLabel({ type: 'ring_world_ruined', label: null, count: 4 })).toBe(
			'ring_world_ruined ×4'
		);
	});
});

describe('relicResourceLabel', () => {
	it('formats and title-cases the resources', () => {
		expect(relicResourceLabel([{ resource: 'unity', amount: 3000, scales: false }])).toBe(
			'3000 Unity'
		);
	});
	it('joins multiple and notes when one scales (Cybrex War Forge cost)', () => {
		expect(
			relicResourceLabel([
				{ resource: 'unity', amount: 3000, scales: false },
				{ resource: 'minerals', amount: 2000, scales: true }
			])
		).toBe('3000 Unity, 2000 Minerals (grows with each use)');
	});
	it('formats a scaling payout (War Forge produces 1000 alloys, +1000/use)', () => {
		expect(relicResourceLabel([{ resource: 'alloys', amount: 1000, scales: true }])).toBe(
			'1000 Alloys (grows with each use)'
		);
	});
	it('is empty for no resources', () => {
		expect(relicResourceLabel([])).toBe('');
	});
});

describe('cooldownLabel', () => {
	it('converts days to Stellaris years (360-day year)', () => {
		expect(cooldownLabel(3600)).toBe('10 years');
		expect(cooldownLabel(900)).toBe('2.5 years');
		expect(cooldownLabel(360)).toBe('1 year');
	});
	it('is null when there is no cooldown', () => {
		expect(cooldownLabel(null)).toBeNull();
		expect(cooldownLabel(0)).toBeNull();
	});
});

describe('dlcBadge', () => {
	it('distinguishes base / Ancient Relics / other DLC', () => {
		expect(dlcBadge(null)).toContain('opacity-50');
		expect(dlcBadge('Ancient Relics Story Pack')).toContain('amber');
		expect(dlcBadge('Cosmic Storms')).toContain('sky');
	});
});

// Exhaustiveness guard: every EmpireType has flags wired up.
describe('empire types', () => {
	it('variantApplies handles every empire type without throwing', () => {
		for (const t of ALL_TYPES) {
			const _: EmpireType = t;
			expect(typeof variantApplies('default', _)).toBe('boolean');
		}
	});
});

describe('groupByDlc', () => {
	const prec = (key: string, name: string | null, dlc: string | null): Precursor =>
		({ key, name, requiredDlc: dlc }) as Precursor;

	it('keeps base game first, then DLCs in first-appearance order', () => {
		const groups = groupByDlc([
			prec('p1', 'Vultaum', null),
			prec('pb', 'Baol', 'Ancient Relics Story Pack'),
			prec('pi', 'Inetian Traders', 'Cosmic Storms')
		]);
		expect(groups.map((g) => g.label)).toEqual([
			'Base game',
			'Ancient Relics Story Pack',
			'Cosmic Storms'
		]);
	});

	it('sorts precursors alphabetically within each DLC group (deterministic)', () => {
		const groups = groupByDlc([
			prec('p2', 'Yuht', null),
			prec('p3', 'First League', null),
			prec('p1', 'Vultaum', null),
			prec('pz', 'Zroni', 'Ancient Relics Story Pack'),
			prec('pb', 'Baol', 'Ancient Relics Story Pack')
		]);
		expect(groups[0].items.map((i) => i.name)).toEqual(['First League', 'Vultaum', 'Yuht']);
		expect(groups[1].items.map((i) => i.name)).toEqual(['Baol', 'Zroni']);
	});

	it('falls back to the key when a name is missing', () => {
		const groups = groupByDlc([prec('zeta', null, null), prec('alpha', null, null)]);
		expect(groups[0].items.map((i) => i.key)).toEqual(['alpha', 'zeta']);
	});
});
