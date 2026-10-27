// The capital a new empire starts with: the game's setup scripts (extraction:
// stellaris-data-extraction extractor/game_start.py) run against the planned empire.
// The scripts branch on the empire (authority, ethics, civics, origin), its species
// (archetype, traits), the homeworld's class and the ship set, and keep running state of their
// own (zones, flags, variables counting rural districts), so they are interpreted here in
// order rather than looked up. A limit the planner can't decide counts as false, and its unknown
// checks are reported, so the preview never claims more than it knows.
import type { Trigger } from '$lib/server/db';
import { evaluate, type EmpireProfile, type Tri } from '$lib/triggers';

type Amount = number | string; // a number, or a script variable's name

export type Effect =
	| { e: 'if'; branches: { limit: Trigger | null; body: Effect[] }[] }
	| { e: 'while'; count: Amount; limit: Trigger | null; body: Effect[] }
	| { e: 'add_building'; building: string; zone?: string; unique?: boolean }
	| { e: 'remove_building'; building: string }
	| { e: 'remove_all_buildings' }
	| { e: 'add_district'; district: string; amount: Amount }
	| { e: 'remove_district'; district: string }
	| { e: 'add_zone'; district: string; zone: string; slot?: number }
	| { e: 'remove_zone'; district: string; zone: string }
	| { e: 'set_variable' | 'change_variable'; which: string; value: Amount }
	| { e: 'clear_variable'; which: string }
	| { e: 'set_flag' | 'remove_flag'; flag: string }
	| { e: 'unknown'; key: string };

// Setup scripts by name: the regular one, and the Void Dwellers' habitat one.
export const SETUP_REGULAR = 'generate_start_buildings_and_districts';
export const SETUP_VOID = 'void_dweller_home_planet_setup';

export interface CapitalInputs {
	profile: EmpireProfile; // from profileFromDraft
	authority: string | null; // government key, e.g. "auth_hive_mind" (has_authority)
	traits: string[]; // the founder species' traits, base and granted included
	archetype: string | null; // the founder class's archetype (BIOLOGICAL, LITHOID, MACHINE, …)
	planetClass: string | null; // the homeworld's class: forced by the origin, else picked
	bioShips: boolean | null; // a biological ship set; null = not picked
}

export interface Capital {
	districts: { district: string; count: number }[]; // in the order first added
	zones: { district: string; zone: string; slot: number | null }[];
	buildings: { building: string; zone: string | null }[];
	unknownChecks: { leaf: string; value: string }[]; // undecidable checks a branch hinged on
	unknownEffects: string[]; // effects the planner does not model
}

// Leaves the empire profile alone can't answer.
type Leaf = { leaf: string; value: string; cmp?: string; which?: string };

const MAX_LOOPS = 100;
// The scripts only test one district set; its sole planet class (common/planet_classes).
const DISTRICT_SET_CLASS: Record<string, string> = { volcanic_world: 'pc_volcanic' };
// Traits the game adds to a species of these archetypes (species_subspecies checks them).
const ARCHETYPE_TRAIT: Record<string, string> = {
	MACHINE: 'trait_machine_unit',
	ROBOT: 'trait_mechanical'
};

export function simulateStartCapital(effects: Effect[], inp: CapitalInputs): Capital {
	const vars = new Map<string, number>();
	const flags = new Set<string>();
	const districts = new Map<string, number>();
	let zones: Capital['zones'] = [];
	let buildings: Capital['buildings'] = [];
	const unknownChecks = new Map<string, Leaf>();
	const unknownEffects = new Set<string>();
	const traits = new Set([
		...inp.traits,
		...(inp.archetype && ARCHETYPE_TRAIT[inp.archetype] ? [ARCHETYPE_TRAIT[inp.archetype]] : [])
	]);

	const amount = (a: Amount): number => (typeof a === 'number' ? a : (vars.get(a) ?? 0));
	const amountOf = (v: string | undefined): number => {
		const n = Number(v);
		return Number.isNaN(n) ? (vars.get(v ?? '') ?? 0) : n;
	};
	const compare = (a: number, cmp: string | undefined, b: number): boolean =>
		cmp === '>'
			? a > b
			: cmp === '>='
				? a >= b
				: cmp === '<'
					? a < b
					: cmp === '<='
						? a <= b
						: cmp === '!='
							? a !== b
							: a === b;
	const yes = (t: Leaf, b: boolean | null): Tri => (b === null ? null : t.value === 'no' ? !b : b);

	// Checks on the capital's own state and the inputs beyond the profile; undefined = ask
	// the profile.
	function leaf(t: Leaf): Tri | undefined {
		switch (t.leaf) {
			case 'check_variable':
				return compare(vars.get(t.which ?? '') ?? 0, t.cmp, amountOf(t.value));
			case 'has_zone':
				return zones.some((z) => z.zone === t.value);
			case 'has_building':
				return buildings.some((b) => b.building === t.value);
			case 'has_carrier_flag':
			case 'has_country_flag':
				return flags.has(t.value);
			case 'is_planet_class':
				return inp.planetClass === null ? null : inp.planetClass === t.value;
			case 'uses_district_set':
				return inp.planetClass === null || !(t.value in DISTRICT_SET_CLASS)
					? null
					: inp.planetClass === DISTRICT_SET_CLASS[t.value];
			case 'uses_ship_category':
				return t.value === 'bio_ship' ? inp.bioShips : null;
			case 'has_trait':
				return traits.has(t.value);
			case 'is_archetype':
				return inp.archetype === null ? null : inp.archetype === t.value;
			case 'is_artificial':
				return yes(t, inp.archetype === null ? null : ['MACHINE', 'ROBOT'].includes(inp.archetype));
			case 'has_authority':
				return inp.authority === null ? null : inp.authority === t.value;
			case 'is_country_type':
				return t.value === 'default'; // a playable empire
			case 'exists':
				return true; // the owner, the planet: always there at game start
			case 'has_menace_perk':
				return false; // nothing ascended at game start
		}
		return undefined;
	}

	const check = (t: Trigger | null): boolean => {
		const v = evaluate(t, inp.profile, { leaf, assumeAbsent: true });
		if (v === null) for (const l of undecided(t)) unknownChecks.set(`${l.leaf}=${l.value}`, l);
		return v === true;
	};
	// The leaves of a tree that can't be decided on their own.
	function undecided(t: Trigger | null): Leaf[] {
		if (t === null) return [];
		if ('leaf' in t)
			return evaluate(t, inp.profile, { leaf, assumeAbsent: true }) === null ? [t] : [];
		return t.args.flatMap(undecided);
	}

	function run(list: Effect[]) {
		for (const x of list) {
			switch (x.e) {
				case 'if': {
					const hit = x.branches.find((b) => check(b.limit));
					if (hit) run(hit.body);
					break;
				}
				case 'while': {
					const n = Math.min(amount(x.count), MAX_LOOPS);
					for (let i = 0; i < n && check(x.limit); i++) run(x.body);
					break;
				}
				case 'add_building':
					if (!(x.unique && buildings.some((b) => b.building === x.building)))
						buildings.push({ building: x.building, zone: x.zone ?? null });
					break;
				case 'remove_building':
					buildings = buildings.filter((b) => b.building !== x.building);
					break;
				case 'remove_all_buildings':
					buildings = [];
					break;
				case 'add_district': {
					const n = amount(x.amount);
					if (n > 0) districts.set(x.district, (districts.get(x.district) ?? 0) + n);
					break;
				}
				case 'remove_district': {
					const n = (districts.get(x.district) ?? 0) - 1;
					if (n > 0) districts.set(x.district, n);
					else districts.delete(x.district);
					break;
				}
				case 'add_zone':
					zones.push({ district: x.district, zone: x.zone, slot: x.slot ?? null });
					break;
				case 'remove_zone':
					zones = zones.filter((z) => !(z.district === x.district && z.zone === x.zone));
					break;
				case 'set_variable':
					vars.set(x.which, amount(x.value));
					break;
				case 'change_variable':
					vars.set(x.which, (vars.get(x.which) ?? 0) + amount(x.value));
					break;
				case 'clear_variable':
					vars.delete(x.which);
					break;
				case 'set_flag':
					flags.add(x.flag);
					break;
				case 'remove_flag':
					flags.delete(x.flag);
					break;
				case 'unknown':
					unknownEffects.add(x.key);
					break;
			}
		}
	}

	run(effects);
	return {
		districts: [...districts].map(([district, count]) => ({ district, count })),
		zones,
		buildings,
		unknownChecks: [...unknownChecks.values()],
		unknownEffects: [...unknownEffects]
	};
}
