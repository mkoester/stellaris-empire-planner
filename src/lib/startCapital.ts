// The capital a new empire starts with: the game's setup scripts (extraction:
// stellaris-data-extraction extractor/game_start.py) run against the planned empire.
// The scripts branch on the empire (authority, ethics, civics, origin), its species
// (archetype, traits), the homeworld's class and the ship set, and keep running state of their
// own (zones, flags, variables counting rural districts), so they are interpreted here in
// order rather than looked up. A limit the planner can't decide counts as false, and its unknown
// checks are reported, so the preview never claims more than it knows.
import type { CivicRequirement, Trigger } from '$lib/server/db';
import { prettyKey } from '$lib/civics';
import { picksFromDraft, type DraftPicks } from '$lib/compat';
import { evaluate, leafText, profileFromDraft, type EmpireProfile, type Tri } from '$lib/triggers';

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

// Why something is there: the conditions that held on the way to it (Materialist ethic,
// Anglers civic, an ocean homeworld). Empty = the setup every empire gets.
export type Reason = { leaf: string; value: string };
// One contribution to a count (a district's, or a variable's that becomes one).
export type Part = { amount: number; reasons: Reason[] };

export interface Capital {
	// In the order first added; `parts` sum to `count`, one per distinct set of reasons.
	districts: { district: string; count: number; parts: Part[] }[];
	zones: { district: string; zone: string; slot: number | null; reasons: Reason[] }[];
	buildings: { building: string; zone: string | null; reasons: Reason[] }[];
	unknownChecks: { leaf: string; value: string }[]; // undecidable checks a branch hinged on
	unknownEffects: string[]; // effects the planner does not model
}

// Leaves the empire profile alone can't answer.
type Leaf = { leaf: string; value: string; cmp?: string; which?: string };

const MAX_LOOPS = 100;
// The scripts only test one district set; its sole planet class (common/planet_classes).
const DISTRICT_SET_CLASS: Record<string, string> = { volcanic_world: 'pc_volcanic' };
// Whether a reason is about this homeworld class (by class, or by its district set).
export const isHomeworld = (r: Reason, planetClass: string): boolean =>
	(r.leaf === 'is_planet_class' && r.value === planetClass) ||
	(r.leaf === 'uses_district_set' && DISTRICT_SET_CLASS[r.value] === planetClass);
// Traits the game adds to a species of these archetypes (species_subspecies checks them).
const ARCHETYPE_TRAIT: Record<string, string> = {
	MACHINE: 'trait_machine_unit',
	ROBOT: 'trait_mechanical'
};
// Checks that explain a pick, by what they are about. The others (a variable, a zone, the
// country type) are the scripts' own bookkeeping.
const REASON_KIND: Record<string, string> = {
	has_ethic: 'ethic',
	has_valid_civic: 'civic',
	has_civic: 'civic',
	has_origin: 'origin',
	has_authority: 'government',
	is_regular_empire: 'authority',
	is_hive_empire: 'authority',
	is_machine_empire: 'authority',
	is_gestalt: 'authority',
	is_nomadic: 'gameplay',
	is_individual_machine: 'species',
	is_archetype: 'species',
	has_trait: 'trait',
	is_planet_class: 'homeworld',
	uses_district_set: 'homeworld',
	uses_ship_category: 'ship set'
};

const reasonKey = (rs: Reason[]) => rs.map((r) => `${r.leaf}=${r.value}`).join('&');
const dedupe = (rs: Reason[]): Reason[] => [
	...new Map(rs.map((r) => [`${r.leaf}=${r.value}`, r])).values()
];
const sum = (parts: Part[]) => parts.reduce((n, p) => n + p.amount, 0);
// Parts with the same reasons merged, those that cancel out dropped.
function mergeParts(parts: Part[]): Part[] {
	const out = new Map<string, Part>();
	for (const p of parts) {
		const k = reasonKey(p.reasons);
		const had = out.get(k);
		out.set(k, { amount: (had?.amount ?? 0) + p.amount, reasons: p.reasons });
	}
	return [...out.values()].filter((p) => p.amount !== 0);
}

// A reason as text, e.g. "Materialist (ethic)", "Ocean World (homeworld)".
export function reasonText(r: Reason, names: Record<string, string>): string {
	const kind = REASON_KIND[r.leaf];
	const text =
		r.leaf === 'is_archetype'
			? `${prettyKey(r.value.toLowerCase())} species`
			: r.leaf === 'uses_ship_category'
				? r.value === 'bio_ship'
					? 'Biological'
					: prettyKey(r.value)
				: r.leaf === 'uses_district_set'
					? prettyKey(r.value)
					: r.leaf === 'is_planet_class' || r.leaf === 'has_authority'
						? (names[r.value] ?? prettyKey(r.value))
						: leafText(r, names);
	return kind && !['authority', 'species', 'gameplay'].includes(kind) ? `${text} (${kind})` : text;
}

// Where something comes from: "from Materialist (ethic) + …", or the setup everyone gets.
export function fromText(rs: Reason[], names: Record<string, string>): string {
	return rs.length ? `from ${rs.map((r) => reasonText(r, names)).join(' + ')}` : 'base setup';
}

// A count's parts: "base setup", "from Anglers (civic)", or "3 base · +1 from Prosperous …".
export function partsText(parts: Part[], names: Record<string, string>): string {
	if (parts.length === 1) return fromText(parts[0].reasons, names);
	return parts
		.map((p, i) => {
			const n = i === 0 ? `${p.amount}` : p.amount > 0 ? `+${p.amount}` : `−${-p.amount}`;
			return `${n} ${p.reasons.length ? fromText(p.reasons, names) : 'base'}`;
		})
		.join(' · ');
}

export function simulateStartCapital(effects: Effect[], inp: CapitalInputs): Capital {
	const vars = new Map<string, Part[]>(); // a variable's value, by where it came from
	const flags = new Map<string, Reason[]>(); // a flag, by why it was set
	const districts = new Map<string, Part[]>();
	let zones: Capital['zones'] = [];
	let buildings: Capital['buildings'] = [];
	const unknownChecks = new Map<string, Leaf>();
	const unknownEffects = new Set<string>();
	const traits = new Set([
		...inp.traits,
		...(inp.archetype && ARCHETYPE_TRAIT[inp.archetype] ? [ARCHETYPE_TRAIT[inp.archetype]] : [])
	]);

	const value = (name: string): number => sum(vars.get(name) ?? []);
	const amount = (a: Amount): number => (typeof a === 'number' ? a : value(a));
	// An amount as parts: a number counts for the current reasons, a variable keeps its own.
	const partsOf = (a: Amount, why: Reason[]): Part[] =>
		typeof a === 'number' ? [{ amount: a, reasons: why }] : (vars.get(a) ?? []);
	const amountOf = (v: string | undefined): number => {
		const n = Number(v);
		return Number.isNaN(n) ? value(v ?? '') : n;
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
				return compare(value(t.which ?? ''), t.cmp, amountOf(t.value));
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

	const test = (t: Trigger | null) => evaluate(t, inp.profile, { leaf, assumeAbsent: true });
	const check = (t: Trigger | null): boolean => {
		const v = test(t);
		if (v === null) for (const l of undecided(t)) unknownChecks.set(`${l.leaf}=${l.value}`, l);
		return v === true;
	};
	// The leaves of a tree that can't be decided on their own.
	function undecided(t: Trigger | null): Leaf[] {
		if (t === null) return [];
		if ('leaf' in t) return test(t) === null ? [t] : [];
		return t.args.flatMap(undecided);
	}
	// Why a limit that holds holds: its explaining leaves that are true, through an `and`
	// all of them, through an `or` the first alternative that holds. A flag stands for why
	// it was set; a negation explains nothing.
	function why(t: Trigger | null): Reason[] {
		if (t === null) return [];
		if ('leaf' in t) {
			if (test(t) !== true || t.value === 'no') return [];
			if (t.leaf === 'has_carrier_flag' || t.leaf === 'has_country_flag')
				return flags.get(t.value) ?? [];
			return t.leaf in REASON_KIND ? [{ leaf: t.leaf, value: t.value }] : [];
		}
		if (t.op === 'and') return t.args.flatMap(why);
		if (t.op === 'or') {
			const hit = t.args.find((a) => test(a) === true);
			return hit ? why(hit) : [];
		}
		return [];
	}

	function run(list: Effect[], ctx: Reason[]) {
		for (const x of list) {
			switch (x.e) {
				case 'if': {
					const hit = x.branches.find((b) => check(b.limit));
					if (hit) run(hit.body, dedupe([...ctx, ...why(hit.limit)]));
					break;
				}
				case 'while': {
					const n = Math.min(amount(x.count), MAX_LOOPS);
					for (let i = 0; i < n && check(x.limit); i++)
						run(x.body, dedupe([...ctx, ...why(x.limit)]));
					break;
				}
				case 'add_building':
					if (!(x.unique && buildings.some((b) => b.building === x.building)))
						buildings.push({ building: x.building, zone: x.zone ?? null, reasons: ctx });
					break;
				case 'remove_building':
					buildings = buildings.filter((b) => b.building !== x.building);
					break;
				case 'remove_all_buildings':
					buildings = [];
					break;
				case 'add_district':
					if (amount(x.amount) > 0)
						districts.set(x.district, [
							...(districts.get(x.district) ?? []),
							...partsOf(x.amount, ctx)
						]);
					break;
				case 'remove_district': {
					const parts = [...(districts.get(x.district) ?? []), { amount: -1, reasons: ctx }];
					if (sum(parts) > 0) districts.set(x.district, parts);
					else districts.delete(x.district);
					break;
				}
				case 'add_zone':
					zones.push({ district: x.district, zone: x.zone, slot: x.slot ?? null, reasons: ctx });
					break;
				case 'remove_zone':
					zones = zones.filter((z) => !(z.district === x.district && z.zone === x.zone));
					break;
				case 'set_variable':
					// Copying another variable within a reason (Arc Welders' energy from mining)
					// credits the reason with all of it.
					vars.set(
						x.which,
						typeof x.value === 'string' && ctx.length
							? [{ amount: amount(x.value), reasons: ctx }]
							: partsOf(x.value, ctx)
					);
					break;
				case 'change_variable':
					vars.set(x.which, [
						...(vars.get(x.which) ?? []),
						...(typeof x.value === 'string' && ctx.length
							? [{ amount: amount(x.value), reasons: ctx }]
							: partsOf(x.value, ctx))
					]);
					break;
				case 'clear_variable':
					vars.delete(x.which);
					break;
				case 'set_flag':
					flags.set(x.flag, ctx);
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

	run(effects, []);
	return {
		districts: [...districts].map(([district, parts]) => ({
			district,
			count: sum(parts),
			parts: mergeParts(parts)
		})),
		zones,
		buildings,
		unknownChecks: [...unknownChecks.values()],
		unknownEffects: [...unknownEffects]
	};
}

// ── The planned empire's capital, and what one pick adds to it ─────────────────
// What running the scripts for a draft needs beyond the draft (layout + page data).
export interface CapitalData {
	gameStartScripts: Record<string, Effect[]>;
	archetypeOf: Record<string, string | null>; // species class → archetype
	nomadicOrigins: string[];
	baseTraitByClass: Record<string, string>;
	originStarts: Record<string, { world: string | null }>;
	compat: { grantedTraits: Record<string, string[]> }; // civic/origin → traits it gives
}

// The capital of a draft as it stands.
export function capitalOf(d: DraftPicks, data: CapitalData): Capital {
	const picks = picksFromDraft(d, data.baseTraitByClass, data.originStarts);
	const profile = profileFromDraft(d, data.archetypeOf, data.nomadicOrigins);
	const granted = [...(d.origin ? [d.origin] : []), ...d.civics].flatMap(
		(k) => data.compat.grantedTraits[k] ?? []
	);
	const script = profile.flags.includes('voidDweller') ? SETUP_VOID : SETUP_REGULAR;
	return simulateStartCapital(data.gameStartScripts[script] ?? [], {
		profile,
		authority: d.authority,
		traits: [...new Set([...(picks.baseTrait ? [picks.baseTrait] : []), ...granted, ...d.traits])],
		archetype: d.speciesClass ? (data.archetypeOf[d.speciesClass] ?? null) : null,
		planetClass: profile.flags.includes('nomadic') ? 'pc_ark' : picks.homeworld,
		bioShips: picks.shipType === null ? null : picks.shipType === 'organic'
	});
}

// What a draft with gaps is completed with to show what a pick adds: a plain empire.
export const CAPITAL_DEFAULTS = {
	authority: 'auth_democratic',
	origin: 'origin_default',
	speciesClass: 'HUM',
	planetClass: 'pc_continental'
} as const;
const GESTALT_ETHIC = 'ethic_gestalt_consciousness';
const GESTALT_SPECIES: Record<string, string> = { auth_machine_intelligence: 'MACHINE' };

// A draft with its unpicked fields defaulted, and those fields named. A gestalt authority
// brings its ethic (and a Machine Intelligence a machine species); a regular one drops it.
export function completeDraft<D extends DraftPicks>(
	d: D,
	data: Pick<CapitalData, 'archetypeOf'>
): {
	draft: D;
	assumed: { field: keyof typeof CAPITAL_DEFAULTS; value: string }[];
} {
	const assumed = (Object.keys(CAPITAL_DEFAULTS) as (keyof typeof CAPITAL_DEFAULTS)[]).filter(
		(k) => d[k] === null
	);
	const draft = { ...d };
	for (const k of assumed) draft[k] = CAPITAL_DEFAULTS[k];
	const auth = draft.authority ?? '';
	const gestalt = auth === 'auth_hive_mind' || auth in GESTALT_SPECIES;
	draft.ethics = gestalt ? [GESTALT_ETHIC] : draft.ethics.filter((e) => e !== GESTALT_ETHIC);
	const species = GESTALT_SPECIES[auth];
	if (species && data.archetypeOf[draft.speciesClass!] !== data.archetypeOf[species])
		draft.speciesClass = species;
	return { draft, assumed: assumed.map((field) => ({ field, value: CAPITAL_DEFAULTS[field] })) };
}

// The government a pick needs: the current one when its authority rules allow it, else
// the first it requires, else the first regular one it doesn't forbid.
const REGULAR_AUTHORITIES = [
	'auth_democratic',
	'auth_oligarchic',
	'auth_dictatorial',
	'auth_imperial'
];
export function fitAuthority(current: string | null, reqs: CivicRequirement[]): string | null {
	const rules = reqs.filter((r) => r.kind === 'authority');
	const required = rules.filter((r) => r.operator !== 'forbid').map((r) => r.value);
	const forbidden = rules.filter((r) => r.operator === 'forbid').map((r) => r.value);
	const ok = (a: string) => (!required.length || required.includes(a)) && !forbidden.includes(a);
	if (current && ok(current)) return current;
	return required[0] ?? REGULAR_AUTHORITIES.find(ok) ?? current;
}

// One thing a pick puts into the capital; `also` = the other conditions it needed.
export interface Contribution {
	kind: 'district' | 'zone' | 'building';
	key: string;
	amount: number | null; // districts only
	also: Reason[];
}

// What in a capital is there because of reasons `own` accepts.
export function contributions(c: Capital, own: (r: Reason) => boolean): Contribution[] {
	const also = (rs: Reason[]) => rs.filter((r) => !own(r));
	return [
		...c.districts.flatMap((d) =>
			d.parts
				.filter((p) => p.reasons.some(own))
				.map((p) => ({
					kind: 'district' as const,
					key: d.district,
					amount: p.amount,
					also: also(p.reasons)
				}))
		),
		...c.zones
			.filter((z) => z.reasons.some(own))
			.map((z) => ({ kind: 'zone' as const, key: z.zone, amount: null, also: also(z.reasons) })),
		...c.buildings
			.filter((b) => b.reasons.some(own))
			.map((b) => ({
				kind: 'building' as const,
				key: b.building,
				amount: null,
				also: also(b.reasons)
			}))
	];
}

// Every value the scripts test with one of these checks (the picks worth a row).
export function mentioned(scripts: Record<string, Effect[]>, leaves: string[]): Set<string> {
	const out = new Set<string>();
	const tree = (t: Trigger | null): void => {
		if (t === null) return;
		if ('leaf' in t) {
			if (leaves.includes(t.leaf)) out.add(t.value);
		} else t.args.forEach(tree);
	};
	const walk = (list: Effect[]): void => {
		for (const x of list)
			if (x.e === 'if')
				for (const b of x.branches) {
					tree(b.limit);
					walk(b.body);
				}
			else if (x.e === 'while') {
				tree(x.limit);
				walk(x.body);
			}
	};
	Object.values(scripts).forEach(walk);
	return out;
}

// A table row: one pick, what it adds to the capital of the draft changed to include it.
export interface PickOption<D extends DraftPicks> {
	key: string;
	label: string;
	active: boolean; // part of the draft
	apply: (d: D) => D; // the draft with this pick
	own: (r: Reason) => boolean; // the reasons that are this pick
}
export interface ContributionRow {
	key: string;
	label: string;
	active: boolean;
	items: Contribution[];
}
export function contributionRows<D extends DraftPicks>(
	options: PickOption<D>[],
	d: D,
	data: CapitalData
): ContributionRow[] {
	return options.map((o) => ({
		key: o.key,
		label: o.label,
		active: o.active,
		items: contributions(capitalOf(completeDraft(o.apply(d), data).draft, data), o.own)
	}));
}
