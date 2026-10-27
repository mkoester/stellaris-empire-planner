// Game trigger trees (traditions, ascension perks) evaluated against an empire profile.
// The extraction stores each potential/possible/swap trigger as a normalised tree
// (stellaris-data-extraction extractor/triggers.py normalize_trigger). Evaluation is
// three-valued: `null` means the profile can't tell (a country flag, a tech, the number of
// traditions taken…), so an item is only hidden when its trigger is definitely false.
import type { Trigger } from '$lib/server/db';
import { prettyKey } from '$lib/civics';

export type Tri = boolean | null;

// ── Empire profile ───────────────────────────────────────────────────────────
export type Authority = 'regular' | 'hive' | 'machine';
export type ProfileFlag =
	'nomadic' | 'wilderness' | 'voidDweller' | 'individualMachine' | 'homicidal' | 'megacorp';

export interface EmpireProfile {
	authority: Authority | null; // null = not chosen
	flags: ProfileFlag[]; // the flags that are set; unset ones are false once the profile is active
	// Known only when the profile comes from the planned empire.
	ethics?: string[];
	civics?: string[];
	origin?: string | null;
}

export const ANY_PROFILE: EmpireProfile = { authority: null, flags: [] };

export const AUTHORITIES: { key: Authority; label: string }[] = [
	{ key: 'regular', label: 'Regular' },
	{ key: 'hive', label: 'Hive Mind' },
	{ key: 'machine', label: 'Machine' }
];

// Flags in display order, with the authority each is limited to and what it rules out.
export const FLAGS: {
	key: ProfileFlag;
	label: string;
	leaf: string;
	only?: Authority;
	excludes?: ProfileFlag[];
}[] = [
	{ key: 'nomadic', label: 'Nomadic', leaf: 'is_nomadic', excludes: ['wilderness'] },
	{
		key: 'wilderness',
		label: 'Wilderness',
		leaf: 'is_wilderness_empire',
		only: 'hive',
		excludes: ['nomadic']
	},
	{ key: 'voidDweller', label: 'Void Dweller', leaf: 'has_void_dweller_origin' },
	{
		key: 'individualMachine',
		label: 'Individual Machine',
		leaf: 'is_individual_machine',
		only: 'regular'
	},
	{ key: 'megacorp', label: 'Megacorp', leaf: 'is_megacorp', only: 'regular' },
	{ key: 'homicidal', label: 'Homicidal', leaf: 'is_homicidal' }
];

const AUTHORITY_LEAVES = ['is_gestalt', 'is_regular_empire', 'is_hive_empire', 'is_machine_empire'];

// Scripted ethic checks (common/scripted_triggers is_militarist …): the plain or fanatic ethic.
const ETHIC_LEAVES: Record<string, string> = {
	is_militarist: 'militarist',
	is_pacifist: 'pacifist',
	is_materialist: 'materialist',
	is_spiritualist: 'spiritualist',
	is_authoritarian: 'authoritarian',
	is_egalitarian: 'egalitarian',
	is_xenophobe: 'xenophobe',
	is_xenophile: 'xenophile'
};

export function isActive(p: EmpireProfile): boolean {
	return p.authority !== null || p.flags.length > 0;
}

// Set the authority, dropping flags that can't go with it.
export function withAuthority(p: EmpireProfile, a: Authority | null): EmpireProfile {
	const flags = p.flags.filter((f) => {
		const only = FLAGS.find((x) => x.key === f)?.only;
		return !only || a === null || only === a;
	});
	return { ...p, authority: a, flags };
}

// Toggle a flag. Turning one on drops the flags it excludes and moves the authority
// to the one the flag requires (Wilderness → Hive).
export function toggleFlag(p: EmpireProfile, f: ProfileFlag): EmpireProfile {
	if (p.flags.includes(f)) return { ...p, flags: p.flags.filter((x) => x !== f) };
	const def = FLAGS.find((x) => x.key === f)!;
	const base = def.only && p.authority !== def.only ? withAuthority(p, def.only) : p;
	return {
		...base,
		flags: [...base.flags.filter((x) => !def.excludes?.includes(x)), f]
	};
}

// Whether a flag can be chosen alongside the profile's authority.
export function flagAllowed(p: EmpireProfile, f: ProfileFlag): boolean {
	const only = FLAGS.find((x) => x.key === f)?.only;
	return !only || p.authority === null || p.authority === only;
}

// Civics that make `is_homicidal` hold (common/scripted_triggers is_homicidal).
const HOMICIDAL_CIVICS = [
	'civic_fanatic_purifiers',
	'civic_machine_terminator',
	'civic_hive_devouring_swarm',
	'civic_scorched_earth',
	'civic_hive_scorched_earth'
];

export interface DraftLike {
	authority: string | null;
	ethics: string[];
	civics: string[];
	origin: string | null;
	speciesClass: string | null;
}

// The profile of the planned empire. `archetypeOf` maps a species class to its archetype
// (MACHINE → Individual Machine when not gestalt); `nomadicOrigins` are the origins that
// require nomadic gameplay (the draft has no nomadic switch of its own).
export function profileFromDraft(
	d: DraftLike,
	archetypeOf: Record<string, string | null>,
	nomadicOrigins: string[]
): EmpireProfile {
	const authority: Authority | null =
		d.authority === null
			? null
			: d.authority === 'auth_hive_mind'
				? 'hive'
				: /machine_intelligence$/.test(d.authority)
					? 'machine'
					: 'regular';
	const flags: ProfileFlag[] = [];
	if (d.origin && nomadicOrigins.includes(d.origin)) flags.push('nomadic');
	if (d.origin === 'origin_wilderness') flags.push('wilderness');
	if (d.origin === 'origin_void_dwellers' || d.origin === 'origin_void_machines')
		flags.push('voidDweller');
	if (authority === 'regular' && d.speciesClass && archetypeOf[d.speciesClass] === 'MACHINE')
		flags.push('individualMachine');
	if (d.authority === 'auth_corporate') flags.push('megacorp');
	if (d.civics.some((c) => HOMICIDAL_CIVICS.includes(c))) flags.push('homicidal');
	return { authority, flags, ethics: d.ethics, civics: d.civics, origin: d.origin };
}

// ── Evaluation ───────────────────────────────────────────────────────────────
export interface EvalOptions {
	perks?: number; // number of ascension perks taken (for the tier search)
	assumeAbsent?: boolean; // unknown origins/civics count as not had (the typical empire)
	// Answers leaves the profile doesn't cover (a planet's state); undefined = not handled.
	leaf?: (t: { leaf: string; value: string; cmp?: string; which?: string }) => Tri | undefined;
}

function leafValue(
	leaf: string,
	value: string,
	cmp: string | undefined,
	p: EmpireProfile,
	o: EvalOptions
): Tri {
	if (cmp) {
		if (leaf === 'num_ascension_perks' && o.perks !== undefined) {
			const n = Number(value);
			return cmp === '>'
				? o.perks > n
				: cmp === '>='
					? o.perks >= n
					: cmp === '<'
						? o.perks < n
						: cmp === '<='
							? o.perks <= n
							: null;
		}
		return null;
	}
	if (leaf === 'host_has_dlc') return true; // all DLC assumed; DLC shows as a badge
	if (leaf === 'always') return value === 'yes';
	const yes = (b: Tri): Tri => (b === null ? null : value === 'no' ? !b : b);
	if (AUTHORITY_LEAVES.includes(leaf)) {
		const a = p.authority;
		if (a === null) return null;
		return yes(
			leaf === 'is_gestalt'
				? a !== 'regular'
				: leaf === 'is_regular_empire'
					? a === 'regular'
					: leaf === 'is_hive_empire'
						? a === 'hive'
						: a === 'machine'
		);
	}
	const flag = FLAGS.find((f) => f.leaf === leaf);
	if (flag) return isActive(p) ? yes(p.flags.includes(flag.key)) : null;
	const known = (list: string[] | undefined): Tri =>
		list ? list.includes(value) : o.assumeAbsent ? false : null;
	if (leaf === 'has_ethic') return known(p.ethics);
	const ethic = ETHIC_LEAVES[leaf];
	if (ethic) {
		if (!p.ethics) return o.assumeAbsent ? yes(false) : null;
		return yes(p.ethics.some((e) => e === `ethic_${ethic}` || e === `ethic_fanatic_${ethic}`));
	}
	if (leaf === 'has_valid_civic' || leaf === 'has_civic') return known(p.civics);
	if (leaf === 'has_origin')
		return p.origin !== undefined ? p.origin === value : o.assumeAbsent ? false : null;
	return null;
}

export function evaluate(t: Trigger | null, p: EmpireProfile, o: EvalOptions = {}): Tri {
	if (t === null) return true;
	if ('leaf' in t) {
		const v = o.leaf?.(t); // null is an answer (unknown), undefined is not
		return v !== undefined ? v : leafValue(t.leaf, t.value, t.cmp, p, o);
	}
	if (t.op === 'not') {
		const v = evaluate(t.args[0], p, o);
		return v === null ? null : !v;
	}
	let unknown = false;
	for (const a of t.args) {
		const v = evaluate(a, p, o);
		if (v === null) unknown = true;
		else if (t.op === 'and' ? !v : v) return t.op !== 'and';
	}
	return unknown ? null : t.op === 'and';
}

// The fewest ascension perks a perk's `possible` needs for this profile (its tier), or
// null when no count makes it pickable. Unknown origins count as absent, so an origin
// exception (Clone Army's early Biomorphosis) doesn't lower everyone's tier.
export function perkTier(possible: Trigger | null, p: EmpireProfile, max = 8): number | null {
	for (let n = 0; n <= max; n++)
		if (evaluate(possible, p, { perks: n, assumeAbsent: true }) !== false) return n;
	return null;
}

// The variant a profile gets: the definitely-true swap with the highest weight
// (first wins a tie), or null for the base item.
export function pickSwap<S extends { trigger: Trigger | null; weight: number }>(
	swaps: S[],
	p: EmpireProfile
): S | null {
	let best: S | null = null;
	for (const s of swaps)
		if (evaluate(s.trigger, p) === true && (best === null || s.weight > best.weight)) best = s;
	return best;
}

// A trigger with every `host_has_dlc` taken as true (all DLC assumed), simplified: the
// branches an all-DLC game never takes drop out. true/false = settled either way.
export function withAllDlc(t: Trigger | null): Trigger | boolean {
	if (t === null) return true;
	if ('leaf' in t) return t.leaf === 'host_has_dlc' ? true : t;
	const args = t.args.map(withAllDlc);
	if (t.op === 'not')
		return typeof args[0] === 'boolean' ? !args[0] : { op: 'not', args: [args[0]] };
	const settles = t.op === 'or'; // the value that decides an or (true) / an and (false)
	if (args.includes(settles)) return settles;
	const rest = args.filter((a): a is Trigger => typeof a !== 'boolean');
	if (!rest.length) return !settles;
	return rest.length === 1 ? rest[0] : { op: t.op, args: rest };
}

// Every leaf with the given key outside a `not` (a requirement, not an exclusion).
export function positiveLeaves(t: Trigger | null, leaf: string): string[] {
	if (t === null) return [];
	if ('leaf' in t) return t.leaf === leaf && t.value !== 'no' ? [t.value] : [];
	if (t.op === 'not') return [];
	return t.args.flatMap((a) => positiveLeaves(a, leaf));
}

// Every leaf key in a tree.
export function leafKeys(t: Trigger | null): string[] {
	if (t === null) return [];
	if ('leaf' in t) return [t.leaf];
	return t.args.flatMap(leafKeys);
}

// ── Display ──────────────────────────────────────────────────────────────────
const LEAF_LABELS: Record<string, string> = {
	is_gestalt: 'Gestalt',
	is_regular_empire: 'Regular empire',
	is_hive_empire: 'Hive Mind',
	is_machine_empire: 'Machine Intelligence',
	is_nomadic: 'Nomadic',
	is_wilderness_empire: 'Wilderness',
	has_void_dweller_origin: 'Void Dweller origin',
	is_individual_machine: 'Individual Machine',
	is_homicidal: 'Homicidal',
	is_megacorp: 'Megacorp',
	is_synthetic_empire: 'Synthetic empire',
	is_natural_design_empire: 'Natural Design',
	is_entropy_drinkers_empire: 'Entropy Drinkers',
	has_genetic_ascension: 'Genetic ascension',
	has_cybernetic_ascension: 'Cybernetic ascension',
	has_synthetic_ascension: 'Synthetic ascension',
	has_psionic_ascension: 'Psionic ascension',
	has_purity_ascension: 'Purity ascension',
	has_cloning_ascension: 'Cloning ascension',
	has_mutation_ascension: 'Mutation ascension',
	federation_check_for_subject_trigger: 'not a subject outside its overlord’s federation',
	...Object.fromEntries(
		Object.entries(ETHIC_LEAVES).map(([leaf, e]) => [leaf, e[0].toUpperCase() + e.slice(1)])
	),
	complex: '(complex condition)'
};

// Leaves naming a game object: their value is shown by name.
const NAMED_LEAVES = new Set([
	'has_ethic',
	'has_valid_civic',
	'has_civic',
	'has_origin',
	'has_ascension_perk',
	'has_tradition',
	'has_active_tradition',
	'has_trait'
]);

export function leafText(
	t: { leaf: string; value: string; cmp?: string },
	names: Record<string, string>
): string {
	if (t.cmp) {
		if (t.leaf === 'num_ascension_perks') {
			const n = Number(t.value) + (t.cmp === '>' ? 1 : 0);
			return `${n}+ ascension perks`;
		}
		if (t.leaf === 'num_tradition_categories' && t.cmp === '<') return 'a free tradition slot';
		return `${prettyKey(t.leaf)} ${t.cmp} ${t.value}`;
	}
	if (t.leaf === 'host_has_dlc') return `${t.value} DLC`;
	if (t.leaf === 'has_technology')
		return names[t.value] ?? `${prettyKey(t.value.replace(/^tech_/, ''))} (tech)`;
	if (t.leaf === 'has_country_flag') return `${prettyKey(t.value)} (event flag)`;
	if (NAMED_LEAVES.has(t.leaf)) return names[t.value] ?? prettyKey(t.value);
	const label = LEAF_LABELS[t.leaf] ?? prettyKey(t.leaf);
	if (t.value === 'yes') return label;
	if (t.value === 'no') return `not ${label}`;
	if (t.value === 'scope') return label;
	return `${label}: ${names[t.value] ?? prettyKey(t.value)}`;
}

// A whole tree as one readable line.
export function triggerText(t: Trigger, names: Record<string, string>): string {
	if ('leaf' in t) return leafText(t, names);
	if (t.op === 'not') return `not ${wrap(t.args[0], names)}`;
	// Variants that read the same (two Domination finisher swaps) show once.
	return [...new Set(t.args.map((a) => wrap(a, names)))].join(t.op === 'and' ? ' and ' : ' or ');
}

function wrap(t: Trigger, names: Record<string, string>): string {
	const text = triggerText(t, names);
	if ('leaf' in t || t.op === 'not') return text;
	// Alternatives that collapsed to one (triggerText dedupes) need no parentheses.
	return new Set(t.args.map((a) => wrap(a, names))).size === 1 ? text : `(${text})`;
}

export interface RequirementLine {
	type: 'needs' | 'excludes';
	text: string;
	leaf: string | null; // the leaf key when the line is a single leaf
	value: string | null;
	state: Tri; // under the profile
}

// A trigger split into chips: one per top-level condition, with `not (a or b)` expanded
// into one "excludes" chip per alternative. `skip` drops leaves shown elsewhere (tier).
export function requirementLines(
	t: Trigger | null,
	names: Record<string, string>,
	p: EmpireProfile,
	skip: string[] = []
): RequirementLine[] {
	if (t === null) return [];
	const top = !('leaf' in t) && t.op === 'and' ? t.args : [t];
	const out: RequirementLine[] = [];
	const line = (type: RequirementLine['type'], x: Trigger) => {
		if ('leaf' in x && skip.includes(x.leaf)) return;
		if (!('leaf' in x) && leafKeys(x).every((k) => skip.includes(k))) return;
		const v = evaluate(x, p);
		out.push({
			type,
			text: triggerText(x, names),
			leaf: 'leaf' in x ? x.leaf : null,
			value: 'leaf' in x ? x.value : null,
			state: type === 'excludes' && v !== null ? !v : v
		});
	};
	for (const x of top) {
		if (!('leaf' in x) && x.op === 'not') {
			const inner = x.args[0];
			const alts = !('leaf' in inner) && inner.op === 'or' ? inner.args : [inner];
			for (const a of alts) line('excludes', a);
		} else line('needs', x);
	}
	return out;
}
