// Ambitions (the game's keys say "crisis"): the paths an ascension perk starts, their levels
// with the currency and requirements each needs and the perks it grants, and the objectives
// that earn the currency.
import { db } from './client';
import type { ConditionalModifier, Trigger } from './traditions';

// One step of an objective's reward, in the order the game applies them, e.g.
// {op: 'base', value: 700}, {op: 'subtract', by: 'count_playable_country', mult: 25}.
export interface RewardStep {
	op: string;
	value?: number;
	by?: string; // a count only the game knows (num_galaxy_systems, galaxy_setup:<setting>)
	var?: string; // a country variable or script value
	mult?: number;
	raw?: unknown;
}

export interface AmbitionPerk {
	key: string;
	name: string | null;
	description: string | null;
	modifiers: (ConditionalModifier & { scope: string })[];
}

export interface AmbitionLevel {
	level: number;
	key: string;
	name: string | null;
	requiredCurrency: number | null;
	requirements: string[];
	perks: AmbitionPerk[];
}

export interface AmbitionObjective {
	key: string;
	name: string | null;
	description: string | null;
	reward: RewardStep[];
	recurring: boolean;
	potential: Trigger | null;
}

export interface Ambition {
	key: string;
	name: string | null;
	description: string | null;
	currency: string | null;
	currencyName: string | null;
	startingPerks: { key: string; name: string | null }[];
	levels: AmbitionLevel[];
	objectives: AmbitionObjective[];
}

const parse = (s: string | null): Trigger | null => (s === null ? null : JSON.parse(s));

export function loadAmbitions(): Ambition[] {
	const d = db();
	const mods = d
		.prepare(
			`SELECT m.perk_key, m.scope, m.modifier_key, m.modifier_value, ml.label, ml.positive_is_good
			 FROM menace_perk_modifier m
			 LEFT JOIN modifier_label ml ON m.modifier_key = ml.modifier_key
			 ORDER BY m.perk_key, m.sort_order`
		)
		.all() as Array<{
		perk_key: string;
		scope: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const perks = new Map<string, AmbitionPerk>(
		(
			d.prepare(`SELECT key, name, description FROM menace_perk`).all() as Array<{
				key: string;
				name: string | null;
				description: string | null;
			}>
		).map((r) => [r.key, { ...r, modifiers: [] }])
	);
	for (const m of mods)
		perks.get(m.perk_key)?.modifiers.push({
			key: m.modifier_key,
			value: m.modifier_value,
			label: m.label,
			positiveIsGood: m.positive_is_good !== 0,
			potential: null,
			scope: m.scope
		});

	const levelPerks = d
		.prepare(`SELECT level_key, perk_key FROM crisis_level_perk ORDER BY level_key, sort_order`)
		.all() as Array<{ level_key: string; perk_key: string }>;
	const levels = new Map(
		(
			d
				.prepare(`SELECT key, name, required_currency, requirements_json FROM crisis_level`)
				.all() as Array<{
				key: string;
				name: string | null;
				required_currency: number | null;
				requirements_json: string;
			}>
		).map((r) => [r.key, r])
	);
	const objectives = new Map(
		(
			d
				.prepare(
					`SELECT key, name, description, reward_json, recurring, potential_json
					 FROM crisis_objective`
				)
				.all() as Array<{
				key: string;
				name: string | null;
				description: string | null;
				reward_json: string;
				recurring: number;
				potential_json: string | null;
			}>
		).map((r) => [r.key, r])
	);
	const pathLevels = d
		.prepare(
			`SELECT path_key, level_key, level FROM crisis_path_level ORDER BY path_key, sort_order`
		)
		.all() as Array<{ path_key: string; level_key: string; level: number }>;
	const pathObjectives = d
		.prepare(
			`SELECT path_key, objective_key FROM crisis_path_objective ORDER BY path_key, sort_order`
		)
		.all() as Array<{ path_key: string; objective_key: string }>;
	const starting = d
		.prepare(
			`SELECT cp.path_key, cp.perk_key, ap.name
			 FROM crisis_path_perk cp LEFT JOIN ascension_perk ap ON ap.key = cp.perk_key
			 ORDER BY cp.path_key, cp.perk_key`
		)
		.all() as Array<{ path_key: string; perk_key: string; name: string | null }>;
	const currencyName = new Map(
		(
			d.prepare(`SELECT key, name FROM strategic_resource`).all() as Array<{
				key: string;
				name: string | null;
			}>
		).map((r) => [r.key, r.name])
	);

	const paths = d
		.prepare(`SELECT key, name, description, currency FROM crisis_path ORDER BY sort_order`)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		currency: string | null;
	}>;
	return paths.map((p) => ({
		key: p.key,
		name: p.name || null,
		description: p.description || null,
		currency: p.currency,
		currencyName: (p.currency && currencyName.get(p.currency)) || null,
		startingPerks: starting
			.filter((s) => s.path_key === p.key)
			.map((s) => ({ key: s.perk_key, name: s.name })),
		levels: pathLevels
			.filter((l) => l.path_key === p.key)
			.map((l): AmbitionLevel => {
				const r = levels.get(l.level_key);
				return {
					level: l.level,
					key: l.level_key,
					name: r?.name ?? null,
					requiredCurrency: r?.required_currency ?? null,
					requirements: r ? JSON.parse(r.requirements_json) : [],
					perks: levelPerks
						.filter((lp) => lp.level_key === l.level_key)
						.flatMap((lp) => perks.get(lp.perk_key) ?? [])
				};
			}),
		objectives: pathObjectives
			.filter((o) => o.path_key === p.key)
			.flatMap((o): AmbitionObjective[] => {
				const r = objectives.get(o.objective_key);
				return r
					? [
							{
								key: r.key,
								name: r.name,
								description: r.description,
								reward: JSON.parse(r.reward_json),
								recurring: r.recurring === 1,
								potential: parse(r.potential_json)
							}
						]
					: [];
			})
	}));
}
