// Tradition trees, ascension perks and the defines behind tradition cost.
import { db } from './client';
import type { Modifier } from './types';

// A normalised game trigger (extraction: extractor/triggers.py normalize_trigger).
export type Trigger =
	| { op: 'and' | 'or' | 'not'; args: Trigger[] }
	| { leaf: string; value: string; cmp?: string; which?: string }; // which: check_variable's variable

// A modifier that may only apply under a condition (triggered_modifier).
export interface ConditionalModifier extends Modifier {
	potential: Trigger | null;
}

// A variant replacing a tradition/perk when its trigger holds.
export interface Swap {
	id: string;
	locKey: string | null; // the swap's `name`; game triggers refer to the swapped tradition by it
	name: string | null;
	description: string | null; // null = the owner's
	trigger: Trigger | null;
	inheritEffects: boolean; // true = the owner's modifiers/tooltip apply
	weight: number;
	tooltip: string | null;
	modifiers: ConditionalModifier[];
}

export interface Tradition {
	key: string;
	role: 'adopt' | 'finish' | 'normal';
	name: string | null;
	description: string | null;
	possible: Trigger | null;
	requires: string[]; // tradition keys of the same tree (tree edges)
	unlocksAgenda: string | null; // council_agenda key the game's tooltip names
	tooltip: string | null;
	modifiers: ConditionalModifier[];
	swaps: Swap[];
}

export interface TraditionTree {
	key: string;
	name: string | null;
	potential: Trigger | null;
	requiredDlc: string | null;
	descs: { trigger: Trigger | null; description: string | null }[];
	adopt: Tradition;
	finish: Tradition;
	traditions: Tradition[]; // the five regular ones, in tree order
}

export interface AscensionPerk {
	key: string;
	name: string | null;
	description: string | null;
	isPath: boolean;
	potential: Trigger | null;
	possible: Trigger | null;
	requiredDlc: string | null;
	tooltip: string | null;
	modifiers: ConditionalModifier[];
	swaps: Swap[];
}

const parse = (s: string | null): Trigger | null => (s === null ? null : JSON.parse(s));

function loadModifiers(): Map<string, ConditionalModifier[]> {
	const rows = db()
		.prepare(
			`SELECT m.owner_key, m.modifier_key, m.modifier_value, m.potential_json,
			        ml.label, ml.positive_is_good
			 FROM tradition_modifier m
			 LEFT JOIN modifier_label ml ON m.modifier_key = ml.modifier_key
			 ORDER BY m.owner_key, m.sort_order`
		)
		.all() as Array<{
		owner_key: string;
		modifier_key: string;
		modifier_value: number;
		potential_json: string | null;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const by = new Map<string, ConditionalModifier[]>();
	for (const r of rows) {
		if (!by.has(r.owner_key)) by.set(r.owner_key, []);
		by.get(r.owner_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0,
			potential: parse(r.potential_json)
		});
	}
	return by;
}

function loadSwaps(mods: Map<string, ConditionalModifier[]>): Map<string, Swap[]> {
	const rows = db()
		.prepare(
			`SELECT id, owner_key, loc_key, name, description, trigger_json, inherit_effects, weight,
			        tooltip
			 FROM tradition_swap ORDER BY owner_key, sort_order`
		)
		.all() as Array<{
		id: string;
		loc_key: string | null;
		owner_key: string;
		name: string | null;
		description: string | null;
		trigger_json: string | null;
		inherit_effects: number;
		weight: number;
		tooltip: string | null;
	}>;
	const by = new Map<string, Swap[]>();
	for (const r of rows) {
		if (!by.has(r.owner_key)) by.set(r.owner_key, []);
		by.get(r.owner_key)!.push({
			id: r.id,
			locKey: r.loc_key,
			name: r.name,
			description: r.description,
			trigger: parse(r.trigger_json),
			inheritEffects: r.inherit_effects !== 0,
			weight: r.weight,
			tooltip: r.tooltip,
			modifiers: mods.get(r.id) ?? []
		});
	}
	return by;
}

export function loadTraditionTrees(): TraditionTree[] {
	const mods = loadModifiers();
	const swaps = loadSwaps(mods);
	const prereqs = db()
		.prepare(`SELECT tradition_key, requires_key FROM tradition_prereq`)
		.all() as Array<{ tradition_key: string; requires_key: string }>;
	const requires = new Map<string, string[]>();
	for (const r of prereqs) {
		if (!requires.has(r.tradition_key)) requires.set(r.tradition_key, []);
		requires.get(r.tradition_key)!.push(r.requires_key);
	}

	const tradRows = db()
		.prepare(
			`SELECT key, category_key, role, name, description, possible_json, unlocks_agenda, tooltip
			 FROM tradition ORDER BY category_key, sort_order`
		)
		.all() as Array<{
		key: string;
		category_key: string;
		role: Tradition['role'];
		name: string | null;
		description: string | null;
		possible_json: string | null;
		unlocks_agenda: string | null;
		tooltip: string | null;
	}>;
	const byTree = new Map<string, Tradition[]>();
	for (const r of tradRows) {
		if (!byTree.has(r.category_key)) byTree.set(r.category_key, []);
		byTree.get(r.category_key)!.push({
			key: r.key,
			role: r.role,
			name: r.name,
			description: r.description,
			possible: parse(r.possible_json),
			requires: requires.get(r.key) ?? [],
			unlocksAgenda: r.unlocks_agenda,
			tooltip: r.tooltip,
			modifiers: mods.get(r.key) ?? [],
			swaps: swaps.get(r.key) ?? []
		});
	}

	const descRows = db()
		.prepare(
			`SELECT category_key, trigger_json, description FROM tradition_category_desc
			 ORDER BY category_key, sort_order`
		)
		.all() as Array<{
		category_key: string;
		trigger_json: string | null;
		description: string | null;
	}>;

	const cats = db()
		.prepare(
			`SELECT key, name, potential_json, required_dlc, adopt_key, finish_key
			 FROM tradition_category ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		potential_json: string | null;
		required_dlc: string | null;
		adopt_key: string;
		finish_key: string;
	}>;

	return cats.flatMap((c) => {
		const all = byTree.get(c.key) ?? [];
		const adopt = all.find((t) => t.key === c.adopt_key);
		const finish = all.find((t) => t.key === c.finish_key);
		if (!adopt || !finish) return [];
		return [
			{
				key: c.key,
				name: c.name,
				potential: parse(c.potential_json),
				requiredDlc: c.required_dlc,
				descs: descRows
					.filter((d) => d.category_key === c.key)
					.map((d) => ({ trigger: parse(d.trigger_json), description: d.description })),
				adopt,
				finish,
				traditions: all.filter((t) => t.role === 'normal')
			}
		];
	});
}

export function loadAscensionPerks(): AscensionPerk[] {
	const mods = loadModifiers();
	const swaps = loadSwaps(mods);
	const rows = db()
		.prepare(
			`SELECT key, name, description, is_path, potential_json, possible_json, required_dlc, tooltip
			 FROM ascension_perk ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		is_path: number;
		potential_json: string | null;
		possible_json: string | null;
		required_dlc: string | null;
		tooltip: string | null;
	}>;
	return rows.map((r) => ({
		key: r.key,
		name: r.name,
		description: r.description,
		isPath: r.is_path !== 0,
		potential: parse(r.potential_json),
		possible: parse(r.possible_json),
		requiredDlc: r.required_dlc,
		tooltip: r.tooltip,
		modifiers: mods.get(r.key) ?? [],
		swaps: swaps.get(r.key) ?? []
	}));
}

// Whitelisted defines (tradition cost formula, tree/perk slot limits), key → value.
export function loadGameDefines(): Record<string, number> {
	const rows = db().prepare(`SELECT key, value FROM game_define`).all() as Array<{
		key: string;
		value: number;
	}>;
	return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// What profileFromDraft needs beyond the draft: species class → archetype, and the
// origins that require nomadic gameplay.
export function loadProfileInputs(): {
	archetypeOf: Record<string, string | null>;
	nomadicOrigins: string[];
} {
	const classes = db().prepare(`SELECT key, archetype FROM species_class`).all() as Array<{
		key: string;
		archetype: string | null;
	}>;
	const nomadic = db()
		.prepare(
			`SELECT origin_key FROM origin_requirement
			 WHERE kind = 'gameplay' AND operator = 'require' AND value = 'nomadic'
			 ORDER BY origin_key`
		)
		.all() as Array<{ origin_key: string }>;
	return {
		archetypeOf: Object.fromEntries(classes.map((c) => [c.key, c.archetype])),
		nomadicOrigins: nomadic.map((r) => r.origin_key)
	};
}

// Edicts and council agendas that a tradition or perk unlocks (unlockedBy non-empty).
export interface Edict {
	key: string;
	name: string | null;
	description: string | null;
	length: number | null; // days; -1 = until cancelled
	cost: Record<string, Record<string, number>> | null; // {cost: {unity: 10}, upkeep: {…}}
	potential: Trigger | null;
	unlockedBy: string[]; // tradition / swap / perk keys
	tooltip: string | null;
	modifiers: ConditionalModifier[];
}

export interface Agenda {
	key: string;
	name: string | null;
	description: string | null;
	cost: number | null; // agenda progress to launch
	finishDays: number | null;
	potential: Trigger | null;
	unlockedBy: string[];
	effectTooltip: string | null; // on launch
	modifiers: ConditionalModifier[]; // while being enacted
	finishModifiers: ConditionalModifier[]; // after launch, for finishDays
}

export function loadUnlockables(): { edicts: Edict[]; agendas: Agenda[] } {
	const mods = loadModifiers();
	const edictRows = db()
		.prepare(
			`SELECT key, name, description, length, cost_json, potential_json, unlocked_by_json, tooltip
			 FROM edict WHERE unlocked_by_json IS NOT NULL ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		length: number | null;
		cost_json: string | null;
		potential_json: string | null;
		unlocked_by_json: string;
		tooltip: string | null;
	}>;
	// Agendas: those unlocked by a tradition/perk, plus the ones a tradition's own
	// unlocks_agenda names (Logistics names Open Markets, which actually gates on Commerce).
	const agendaRows = db()
		.prepare(
			`SELECT key, name, description, cost, finish_days, potential_json, unlocked_by_json,
			        effect_tooltip
			 FROM council_agenda
			 WHERE unlocked_by_json IS NOT NULL
			    OR key IN (SELECT unlocks_agenda FROM tradition WHERE unlocks_agenda IS NOT NULL)
			 ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		cost: number | null;
		finish_days: number | null;
		potential_json: string | null;
		unlocked_by_json: string | null;
		effect_tooltip: string | null;
	}>;
	const hinted = db()
		.prepare(`SELECT key, unlocks_agenda FROM tradition WHERE unlocks_agenda IS NOT NULL`)
		.all() as Array<{ key: string; unlocks_agenda: string }>;
	return {
		edicts: edictRows.map((r) => ({
			key: r.key,
			name: r.name,
			description: r.description,
			length: r.length,
			cost: r.cost_json ? JSON.parse(r.cost_json) : null,
			potential: parse(r.potential_json),
			unlockedBy: JSON.parse(r.unlocked_by_json),
			tooltip: r.tooltip,
			modifiers: mods.get(r.key) ?? []
		})),
		agendas: agendaRows.map((r) => ({
			key: r.key,
			name: r.name,
			description: r.description,
			cost: r.cost,
			finishDays: r.finish_days,
			potential: parse(r.potential_json),
			unlockedBy: [
				...new Set([
					...(r.unlocked_by_json ? (JSON.parse(r.unlocked_by_json) as string[]) : []),
					...hinted.filter((h) => h.unlocks_agenda === r.key).map((h) => h.key)
				])
			],
			effectTooltip: r.effect_tooltip,
			modifiers: mods.get(r.key) ?? [],
			finishModifiers: mods.get(`${r.key}#finish`) ?? []
		}))
	};
}
