// Ideologies (4.6): the types per ethic, strength levels and what each gives an adopter, where
// Ideological Strength comes from, and the tenets with their tiers ("Intensity").
import { db } from './client';
import type { ConditionalModifier, Trigger } from './traditions';

export type TenetScope = 'country' | 'colony' | 'system' | 'pop_group' | 'leader';
export type IdeologyScope = 'country' | 'system' | 'pop_group';

export interface TenetModifier extends ConditionalModifier {
	scope: TenetScope;
	possible: Trigger | null; // shown always, active only while it holds
}

export interface TenetTier {
	tier: number;
	effect: string | null; // custom tooltips: effects not written as modifiers
	modifiers: TenetModifier[];
}

export interface TenetUnlock {
	tier: number | null; // null = on codifying it
	kind: string; // edict, policy, agenda, …
	key: string;
	name: string | null;
	description: string | null;
}

export interface Tenet {
	key: string;
	name: string | null;
	description: string | null;
	ethics: string[]; // [] = any ideology
	priority: 'high' | 'default' | 'low';
	sourceCivic: string | null; // civic or origin key it comes from
	potential: Trigger | null;
	unlockText: string | null;
	lockText: string | null;
	swaps: { trigger: Trigger | null; name: string | null; description: string | null }[];
	tiers: TenetTier[];
	unlocks: TenetUnlock[];
}

export interface IdeologyModifier extends ConditionalModifier {
	scope: IdeologyScope;
	level: number | null; // strength level it is gated on; null = any
	header: string | null; // "Inside Ideological Reach:"
	scaledBy: string | null; // a multiplier only the running game knows
}

export interface Ideology {
	key: string;
	ethic: string | null;
	secondaryEthic: string | null; // xenophobe variants: the ethic that favours this one
	opposedSecondaryEthic: string | null;
	faction: string | null;
	factionName: string | null;
	reach: string | null;
	typeName: string | null; // "Ideology", "Religion"
	levels: { level: number; start: number | null; end: number | null }[];
	modifiers: IdeologyModifier[];
}

export interface StrengthSource {
	category: string | null;
	label: string | null;
	op: string | null; // add, subtract, mult, set
	value: number | null; // null when only the running game knows it
	valueRef: string | null;
	condition: Trigger | null;
}

export interface IdeologyData {
	ideologies: Ideology[];
	tenets: Tenet[];
	strengthSources: StrengthSource[];
	concepts: Record<string, { name: string | null; text: string | null }>;
	ideologyBuildings: { key: string; potential: Trigger | null }[];
	// Ambition perks that add a tenet slot (additional_tenet_add), with the path that grants them
	extraTenetPerks: {
		key: string;
		name: string | null;
		amount: number;
		pathKey: string | null;
		pathName: string | null;
		pathLevel: number | null;
	}[];
}

const parse = (s: string | null): Trigger | null => (s === null ? null : JSON.parse(s));

type Labelled = {
	modifier_key: string;
	modifier_value: number;
	label: string | null;
	positive_is_good: number | null;
};
const modifier = (m: Labelled, potential: string | null): ConditionalModifier => ({
	key: m.modifier_key,
	value: m.modifier_value,
	label: m.label,
	positiveIsGood: m.positive_is_good !== 0,
	potential: parse(potential)
});

// Names of the things a tenet's tooltips link to, by link kind.
const UNLOCK_NAMES: Record<string, string> = {
	edict: `SELECT key, name, description FROM edict`,
	agenda: `SELECT key, name, description FROM council_agenda`,
	policy: `SELECT key, name, description FROM policy_option`,
	starbase_building: `SELECT key, name, NULL AS description FROM starbase_part`
};

function unlockNames(): Map<string, { name: string | null; description: string | null }> {
	const out = new Map<string, { name: string | null; description: string | null }>();
	for (const [kind, sql] of Object.entries(UNLOCK_NAMES))
		for (const r of db().prepare(sql).all() as Array<{
			key: string;
			name: string | null;
			description: string | null;
		}>)
			if (!out.has(`${kind}:${r.key}`)) out.set(`${kind}:${r.key}`, r);
	return out;
}

function loadTenets(): Tenet[] {
	const rows = db()
		.prepare(
			`SELECT key, name, description, ethics_json, priority, source_civic, potential_json,
			        unlock_text, lock_text
			 FROM tenet ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		ethics_json: string;
		priority: Tenet['priority'];
		source_civic: string | null;
		potential_json: string | null;
		unlock_text: string | null;
		lock_text: string | null;
	}>;
	const tenets = new Map<string, Tenet>(
		rows.map((r) => [
			r.key,
			{
				key: r.key,
				name: r.name,
				description: r.description,
				ethics: JSON.parse(r.ethics_json),
				priority: r.priority,
				sourceCivic: r.source_civic,
				potential: parse(r.potential_json),
				unlockText: r.unlock_text,
				lockText: r.lock_text,
				swaps: [],
				tiers: [],
				unlocks: []
			}
		])
	);
	const tier = (t: Tenet, n: number): TenetTier => {
		let found = t.tiers.find((x) => x.tier === n);
		if (!found) {
			t.tiers.push((found = { tier: n, effect: null, modifiers: [] }));
			t.tiers.sort((a, b) => a.tier - b.tier);
		}
		return found;
	};

	for (const m of db()
		.prepare(
			`SELECT m.tenet_key, m.tier, m.scope, m.modifier_key, m.modifier_value, m.potential_json,
			        m.possible_json, ml.label, ml.positive_is_good
			 FROM tenet_tier_modifier m
			 LEFT JOIN modifier_label ml ON m.modifier_key = ml.modifier_key
			 ORDER BY m.tenet_key, m.tier, m.sort_order`
		)
		.all() as Array<
		Labelled & {
			tenet_key: string;
			tier: number;
			scope: TenetScope;
			potential_json: string | null;
			possible_json: string | null;
		}
	>) {
		const t = tenets.get(m.tenet_key);
		if (t)
			tier(t, m.tier).modifiers.push({
				...modifier(m, m.potential_json),
				scope: m.scope,
				possible: parse(m.possible_json)
			});
	}
	for (const r of db()
		.prepare(`SELECT tenet_key, tier, effect_text FROM tenet_tier ORDER BY tenet_key, tier`)
		.all() as Array<{ tenet_key: string; tier: number; effect_text: string | null }>) {
		const t = tenets.get(r.tenet_key);
		if (t) tier(t, r.tier).effect = r.effect_text;
	}
	for (const r of db()
		.prepare(
			`SELECT tenet_key, trigger_json, name, description FROM tenet_swap
			 ORDER BY tenet_key, sort_order`
		)
		.all() as Array<{
		tenet_key: string;
		trigger_json: string | null;
		name: string | null;
		description: string | null;
	}>)
		tenets.get(r.tenet_key)?.swaps.push({
			trigger: parse(r.trigger_json),
			name: r.name,
			description: r.description
		});
	const names = unlockNames();
	for (const r of db()
		.prepare(
			`SELECT tenet_key, tier, kind, target_key FROM tenet_unlock ORDER BY tenet_key, sort_order`
		)
		.all() as Array<{ tenet_key: string; tier: number | null; kind: string; target_key: string }>) {
		const n = names.get(`${r.kind}:${r.target_key}`);
		tenets.get(r.tenet_key)?.unlocks.push({
			tier: r.tier,
			kind: r.kind,
			key: r.target_key,
			name: n?.name ?? null,
			description: n?.description ?? null
		});
	}
	return [...tenets.values()];
}

function loadIdeologyTypes(): Ideology[] {
	const rows = db()
		.prepare(
			`SELECT key, ethic, secondary_ethic, opposed_secondary_ethic, faction, faction_name, reach,
			        type_name
			 FROM ideology ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		ethic: string | null;
		secondary_ethic: string | null;
		opposed_secondary_ethic: string | null;
		faction: string | null;
		faction_name: string | null;
		reach: string | null;
		type_name: string | null;
	}>;
	const levels = db()
		.prepare(
			`SELECT ideology_key, level, start_value, end_value FROM ideology_strength_level
			 ORDER BY ideology_key, level`
		)
		.all() as Array<{
		ideology_key: string;
		level: number;
		start_value: number | null;
		end_value: number | null;
	}>;
	const mods = db()
		.prepare(
			`SELECT m.ideology_key, m.scope, m.level, m.header, m.modifier_key, m.modifier_value,
			        m.scaled_by, m.potential_json, ml.label, ml.positive_is_good
			 FROM ideology_modifier m
			 LEFT JOIN modifier_label ml ON m.modifier_key = ml.modifier_key
			 ORDER BY m.ideology_key, m.sort_order`
		)
		.all() as Array<
		Labelled & {
			ideology_key: string;
			scope: IdeologyScope;
			level: number | null;
			header: string | null;
			scaled_by: string | null;
			potential_json: string | null;
		}
	>;
	return rows.map((r) => ({
		key: r.key,
		ethic: r.ethic,
		secondaryEthic: r.secondary_ethic,
		opposedSecondaryEthic: r.opposed_secondary_ethic,
		faction: r.faction,
		factionName: r.faction_name,
		reach: r.reach,
		typeName: r.type_name,
		levels: levels
			.filter((l) => l.ideology_key === r.key)
			.map((l) => ({ level: l.level, start: l.start_value, end: l.end_value })),
		modifiers: mods
			.filter((m) => m.ideology_key === r.key)
			.map((m) => ({
				...modifier(m, m.potential_json),
				scope: m.scope,
				level: m.level,
				header: m.header,
				scaledBy: m.scaled_by
			}))
	}));
}

export function loadIdeologies(): IdeologyData {
	const strengthSources = (
		db()
			.prepare(
				`SELECT category, label, op, value, value_ref, condition_json
				 FROM ideology_strength_source ORDER BY sort_order`
			)
			.all() as Array<{
			category: string | null;
			label: string | null;
			op: string | null;
			value: number | null;
			value_ref: string | null;
			condition_json: string | null;
		}>
	).map((r) => ({
		category: r.category,
		label: r.label,
		op: r.op,
		value: r.value,
		valueRef: r.value_ref,
		condition: parse(r.condition_json)
	}));
	const concepts = Object.fromEntries(
		(
			db().prepare(`SELECT key, name, text FROM ideology_concept`).all() as Array<{
				key: string;
				name: string | null;
				text: string | null;
			}>
		).map((r) => [r.key, { name: r.name, text: r.text }])
	);
	const ideologyBuildings = (
		db()
			.prepare(`SELECT building_key, potential_json FROM ideology_building ORDER BY sort_order`)
			.all() as Array<{ building_key: string; potential_json: string | null }>
	).map((r) => ({ key: r.building_key, potential: parse(r.potential_json) }));
	const extraTenetPerks = (
		db()
			.prepare(
				`SELECT p.key, p.name, m.modifier_value AS amount,
				        (SELECT cp.path_key FROM crisis_level_perk lp
				         JOIN crisis_path_level cp ON cp.level_key = lp.level_key
				         WHERE lp.perk_key = p.key LIMIT 1) AS path_key,
				        (SELECT NULLIF(cp.name, '') FROM crisis_level_perk lp
				         JOIN crisis_path_level cl ON cl.level_key = lp.level_key
				         JOIN crisis_path cp ON cp.key = cl.path_key
				         WHERE lp.perk_key = p.key LIMIT 1) AS path_name,
				        (SELECT cl.level FROM crisis_level_perk lp
				         JOIN crisis_path_level cl ON cl.level_key = lp.level_key
				         WHERE lp.perk_key = p.key LIMIT 1) AS path_level
				 FROM menace_perk_modifier m JOIN menace_perk p ON p.key = m.perk_key
				 WHERE m.modifier_key = 'additional_tenet_add'
				 ORDER BY p.sort_order`
			)
			.all() as Array<{
			key: string;
			name: string | null;
			amount: number;
			path_key: string | null;
			path_name: string | null;
			path_level: number | null;
		}>
	).map((r) => ({
		key: r.key,
		name: r.name,
		amount: r.amount,
		pathKey: r.path_key,
		pathName: r.path_name,
		pathLevel: r.path_level
	}));
	return {
		ideologies: loadIdeologyTypes(),
		tenets: loadTenets(),
		strengthSources,
		concepts,
		ideologyBuildings,
		extraTenetPerks
	};
}
