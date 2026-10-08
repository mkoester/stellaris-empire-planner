// Federation types (with the perks each level grants) and federation laws.
import { db } from './client';
import type { ConditionalModifier, Trigger } from './traditions';

export type PerkScope = 'members' | 'federation' | 'leader' | 'envoy';

export interface FederationPerkModifier extends ConditionalModifier {
	scope: PerkScope;
}

export interface FederationPerk {
	key: string;
	name: string | null;
	description: string | null; // flavour
	effect: string | null; // effect text not expressed as modifiers
	modifiers: FederationPerkModifier[];
}

export interface FederationLevel {
	level: number;
	experience: number | null; // XP to the next level; null at the top
	perks: FederationPerk[];
}

export interface FederationType {
	key: string;
	name: string | null;
	description: string | null;
	baseIntel: number | null;
	potential: Trigger | null;
	allow: Trigger | null; // who may form it
	unlockedBy: string[]; // tradition / swap / perk / ethic / civic keys that grant access
	excludedBy: string[]; // civics that rule it out
	levels: FederationLevel[];
}

export interface FederationLaw {
	key: string;
	name: string | null;
	description: string | null;
	types: string[]; // only for these federation types; empty = all
	requiredCentralization: number | null;
	cohesionGrowth: number | null; // per month
}

export interface FederationLawCategory {
	key: string;
	name: string | null;
	description: string | null;
	laws: FederationLaw[];
}

const parse = (s: string | null): Trigger | null => (s === null ? null : JSON.parse(s));
const list = (s: string | null): string[] => (s === null ? [] : JSON.parse(s));

function loadPerks(): Map<string, FederationPerk> {
	const mods = db()
		.prepare(
			`SELECT m.perk_key, m.scope, m.modifier_key, m.modifier_value, m.potential_json,
			        ml.label, ml.positive_is_good
			 FROM federation_perk_modifier m
			 LEFT JOIN modifier_label ml ON m.modifier_key = ml.modifier_key
			 ORDER BY m.perk_key, m.sort_order`
		)
		.all() as Array<{
		perk_key: string;
		scope: PerkScope;
		modifier_key: string;
		modifier_value: number;
		potential_json: string | null;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const rows = db()
		.prepare(`SELECT key, name, description, effect FROM federation_perk ORDER BY sort_order`)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		effect: string | null;
	}>;
	const perks = new Map<string, FederationPerk>(rows.map((r) => [r.key, { ...r, modifiers: [] }]));
	for (const m of mods)
		perks.get(m.perk_key)?.modifiers.push({
			key: m.modifier_key,
			value: m.modifier_value,
			label: m.label,
			positiveIsGood: m.positive_is_good !== 0,
			potential: parse(m.potential_json),
			scope: m.scope
		});
	return perks;
}

export function loadFederations(): {
	federationTypes: FederationType[];
	lawCategories: FederationLawCategory[];
} {
	const perks = loadPerks();
	const levelRows = db()
		.prepare(
			`SELECT type_key, level, experience, perk_key FROM federation_type_perk
			 ORDER BY type_key, sort_order`
		)
		.all() as Array<{
		type_key: string;
		level: number;
		experience: number | null;
		perk_key: string;
	}>;
	const typeRows = db()
		.prepare(
			`SELECT key, name, description, base_intel, potential_json, allow_json, unlocked_by_json,
			        excluded_by_json
			 FROM federation_type ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		base_intel: number | null;
		potential_json: string | null;
		allow_json: string | null;
		unlocked_by_json: string | null;
		excluded_by_json: string | null;
	}>;
	const federationTypes = typeRows.map((r): FederationType => {
		const levels: FederationLevel[] = [];
		for (const l of levelRows.filter((x) => x.type_key === r.key)) {
			let lv = levels.find((x) => x.level === l.level);
			if (!lv) levels.push((lv = { level: l.level, experience: l.experience, perks: [] }));
			const perk = perks.get(l.perk_key);
			if (perk) lv.perks.push(perk);
		}
		return {
			key: r.key,
			name: r.name,
			description: r.description,
			baseIntel: r.base_intel,
			potential: parse(r.potential_json),
			allow: parse(r.allow_json),
			unlockedBy: list(r.unlocked_by_json),
			excludedBy: list(r.excluded_by_json),
			levels
		};
	});

	const lawRows = db()
		.prepare(
			`SELECT key, category_key, name, description, types_json, required_centralization,
			        cohesion_growth
			 FROM federation_law ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		category_key: string;
		name: string | null;
		description: string | null;
		types_json: string | null;
		required_centralization: number | null;
		cohesion_growth: number | null;
	}>;
	const catRows = db()
		.prepare(`SELECT key, name, description FROM federation_law_category ORDER BY sort_order`)
		.all() as Array<{ key: string; name: string | null; description: string | null }>;
	const lawCategories = catRows
		.map((c) => ({
			...c,
			laws: lawRows
				.filter((l) => l.category_key === c.key)
				.map((l) => ({
					key: l.key,
					name: l.name,
					description: l.description,
					types: list(l.types_json),
					requiredCentralization: l.required_centralization,
					cohesionGrowth: l.cohesion_growth
				}))
		}))
		.filter((c) => c.laws.length);
	return { federationTypes, lawCategories };
}
