import Database from 'better-sqlite3';
import { STELLARIS_DB } from '$env/static/private';

let _db: Database.Database | null = null;

function db(): Database.Database {
	if (!_db) {
		_db = new Database(STELLARIS_DB, { readonly: true, fileMustExist: true });
	}
	return _db;
}

export interface Archetype {
	key: string;
	traitPoints: number;
	maxTraits: number;
	robotic: boolean;
	baseTrait: string | null;
}

export interface TraitCategory {
	key: string;
	label: string;
	colorHex: string | null;
	displayOrder: number;
}

export interface SpeciesClass {
	key: string;
	label: string;
	archetype: string;
}

export function loadTraitCategories(): TraitCategory[] {
	const rows = db()
		.prepare(
			`SELECT tc.key, tc.label, tc.display_order, nc.r, nc.g, nc.b
			 FROM trait_category tc
			 LEFT JOIN named_color nc ON nc.key = tc.color_key
			 ORDER BY tc.display_order`
		)
		.all() as Array<{
		key: string;
		label: string;
		display_order: number;
		r: number | null;
		g: number | null;
		b: number | null;
	}>;

	return rows.map((r) => ({
		key: r.key,
		label: r.label,
		colorHex:
			r.r !== null
				? `#${r.r.toString(16).padStart(2, '0')}${r.g!.toString(16).padStart(2, '0')}${r.b!.toString(16).padStart(2, '0')}`
				: null,
		displayOrder: r.display_order
	}));
}

export function loadSpeciesClasses(): SpeciesClass[] {
	const rows = db()
		.prepare(
			`SELECT key, label, archetype FROM species_class
			 WHERE label IS NOT NULL AND archetype IN ('BIOLOGICAL', 'LITHOID', 'MACHINE')
			 ORDER BY archetype, label`
		)
		.all() as Array<{ key: string; label: string; archetype: string }>;
	return rows.map((r) => ({ key: r.key, label: r.label, archetype: r.archetype }));
}

export function loadTraitsForKeys(keys: string[]): Trait[] {
	if (keys.length === 0) return [];
	const ph = keys.map(() => '?').join(',');
	const rows = db()
		.prepare(
			`SELECT
				t.key, t.cost, t.category, t.initial, t.hidden, t.required_dlc,
				GROUP_CONCAT(DISTINCT ta.archetype) AS archetypes,
				GROUP_CONCAT(DISTINCT to2.opposite_key) AS opposites,
				GROUP_CONCAT(DISTINCT tt.tag) AS tags,
				GROUP_CONCAT(DISTINCT tsc.species_class_key) AS species_classes
			FROM trait t
			LEFT JOIN trait_archetype ta ON t.key = ta.trait_key
			LEFT JOIN trait_opposite to2 ON t.key = to2.trait_key
			LEFT JOIN trait_tag tt ON t.key = tt.trait_key
			LEFT JOIN trait_species_class tsc ON t.key = tsc.trait_key
			WHERE t.key IN (${ph})
			GROUP BY t.key`
		)
		.all(...keys) as Array<{
		key: string;
		cost: number | null;
		category: string;
		initial: number;
		hidden: number;
		required_dlc: string | null;
		archetypes: string | null;
		opposites: string | null;
		tags: string | null;
		species_classes: string | null;
	}>;

	const traits = rows.map((r) => ({
		key: r.key,
		cost: r.cost,
		category: r.category ?? 'phenotype',
		initial: r.initial,
		hidden: r.hidden,
		required_dlc: r.required_dlc,
		archetypes: r.archetypes ? r.archetypes.split(',') : [],
		opposites: r.opposites ? r.opposites.split(',') : [],
		tags: r.tags ? r.tags.split(',') : [],
		speciesClasses: r.species_classes ? r.species_classes.split(',') : [],
		modifiers: [] as Modifier[]
	}));

	const modRows = db()
		.prepare(
			`SELECT tm.trait_key, tm.modifier_key, tm.modifier_value, ml.label, ml.positive_is_good
			 FROM trait_modifier tm
			 LEFT JOIN modifier_label ml ON tm.modifier_key = ml.modifier_key
			 WHERE tm.trait_key IN (${ph})
			 ORDER BY tm.trait_key, tm.sort_order`
		)
		.all(...keys) as Array<{
		trait_key: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;

	const modByTrait = new Map<string, Modifier[]>();
	for (const r of modRows) {
		if (!modByTrait.has(r.trait_key)) modByTrait.set(r.trait_key, []);
		modByTrait.get(r.trait_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	return traits.map((t) => ({ ...t, modifiers: modByTrait.get(t.key) ?? [] }));
}

export function loadArchetypes(): Record<string, Archetype> {
	const rows = db()
		.prepare(
			`SELECT key, trait_points, max_traits, robotic, base_trait
			 FROM species_archetype`
		)
		.all() as Array<{
		key: string;
		trait_points: number | null;
		max_traits: number | null;
		robotic: number;
		base_trait: string | null;
	}>;

	return Object.fromEntries(
		rows.map((r) => [
			r.key,
			{
				key: r.key,
				traitPoints: r.trait_points ?? 0,
				maxTraits: r.max_traits ?? 5,
				robotic: r.robotic === 1,
				baseTrait: r.base_trait
			}
		])
	);
}

export interface Modifier {
	key: string;
	value: number;
	label: string | null;
	positiveIsGood: boolean;
}

export interface Trait {
	key: string;
	cost: number | null;
	category: string;
	initial: number;
	hidden: number;
	required_dlc: string | null;
	archetypes: string[]; // from trait_archetype
	opposites: string[]; // from trait_opposite
	tags: string[]; // from trait_tag
	speciesClasses: string[]; // from trait_species_class — empty = no restriction
	modifiers: Modifier[]; // from trait_modifier + modifier_label
}

export interface EthicImplication {
	tag: string;
	label: string;
}

export interface Ethic {
	key: string;
	label: string | null;
	cost: number;
	gestalt: boolean;
	fanatic_variant: string | null;
	regular_variant: string | null;
	modifiers: Modifier[];
	implications: EthicImplication[];
}

export function loadEthics(): Ethic[] {
	const rows = db()
		.prepare(
			`SELECT key, label, cost, gestalt, fanatic_variant, regular_variant
			 FROM ethic
			 WHERE cost >= 1
			 ORDER BY gestalt ASC, cost DESC, key ASC`
		)
		.all() as Array<{
		key: string;
		label: string | null;
		cost: number;
		gestalt: number;
		fanatic_variant: string | null;
		regular_variant: string | null;
	}>;

	const modRows = db()
		.prepare(
			`SELECT em.ethic_key, em.modifier_key, em.modifier_value, ml.label, ml.positive_is_good
			 FROM ethic_modifier em
			 LEFT JOIN modifier_label ml ON em.modifier_key = ml.modifier_key
			 ORDER BY em.ethic_key, em.sort_order`
		)
		.all() as Array<{
		ethic_key: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;

	const modByEthic = new Map<string, Modifier[]>();
	for (const r of modRows) {
		if (!modByEthic.has(r.ethic_key)) modByEthic.set(r.ethic_key, []);
		modByEthic.get(r.ethic_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	const tagRows = db()
		.prepare(
			`SELECT et.ethic_key, et.tag, etl.label
			 FROM ethic_tag et
			 LEFT JOIN ethic_tag_label etl ON et.tag = etl.tag
			 ORDER BY et.ethic_key, et.sort_order`
		)
		.all() as Array<{ ethic_key: string; tag: string; label: string | null }>;

	const tagsByEthic = new Map<string, EthicImplication[]>();
	for (const r of tagRows) {
		if (!r.label) continue; // skip tags without a readable label
		if (!tagsByEthic.has(r.ethic_key)) tagsByEthic.set(r.ethic_key, []);
		tagsByEthic.get(r.ethic_key)!.push({ tag: r.tag, label: r.label });
	}

	return rows.map((r) => ({
		key: r.key,
		label: r.label,
		cost: r.cost,
		gestalt: r.gestalt === 1,
		fanatic_variant: r.fanatic_variant,
		regular_variant: r.regular_variant,
		modifiers: modByEthic.get(r.key) ?? [],
		implications: tagsByEthic.get(r.key) ?? []
	}));
}

export function loadTraits(): Trait[] {
	const rows = db()
		.prepare(
			`
		SELECT
			t.key,
			t.cost,
			t.category,
			t.initial,
			t.hidden,
			t.required_dlc,
			GROUP_CONCAT(DISTINCT ta.archetype) AS archetypes,
			GROUP_CONCAT(DISTINCT to2.opposite_key) AS opposites,
			GROUP_CONCAT(DISTINCT tt.tag) AS tags,
			GROUP_CONCAT(DISTINCT tsc.species_class_key) AS species_classes
		FROM trait t
		LEFT JOIN trait_archetype ta ON t.key = ta.trait_key
		LEFT JOIN trait_opposite to2 ON t.key = to2.trait_key
		LEFT JOIN trait_tag tt ON t.key = tt.trait_key
		LEFT JOIN trait_species_class tsc ON t.key = tsc.trait_key
		WHERE t.initial = 1 AND t.hidden = 0
		  AND (
		    t.category IS NOT NULL
		    OR (
		      t.cost IS NOT NULL AND t.cost != 0
		      AND EXISTS (SELECT 1 FROM trait_archetype ta2 WHERE ta2.trait_key = t.key)
		    )
		  )
		GROUP BY t.key
		ORDER BY t.category, t.cost
	`
		)
		.all() as Array<{
		key: string;
		cost: number | null;
		category: string;
		initial: number;
		hidden: number;
		required_dlc: string | null;
		archetypes: string | null;
		opposites: string | null;
		tags: string | null;
		species_classes: string | null;
	}>;

	const traits = rows.map((r) => ({
		key: r.key,
		cost: r.cost,
		category: r.category ?? 'phenotype',
		initial: r.initial,
		hidden: r.hidden,
		required_dlc: r.required_dlc,
		archetypes: r.archetypes ? r.archetypes.split(',') : [],
		opposites: r.opposites ? r.opposites.split(',') : [],
		tags: r.tags ? r.tags.split(',') : [],
		speciesClasses: r.species_classes ? r.species_classes.split(',') : [],
		modifiers: [] as Modifier[]
	}));

	const modRows = db()
		.prepare(
			`SELECT tm.trait_key, tm.modifier_key, tm.modifier_value, ml.label, ml.positive_is_good
			 FROM trait_modifier tm
			 LEFT JOIN modifier_label ml ON tm.modifier_key = ml.modifier_key
			 ORDER BY tm.trait_key, tm.sort_order`
		)
		.all() as Array<{
		trait_key: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;

	const modByTrait = new Map<string, Modifier[]>();
	for (const r of modRows) {
		if (!modByTrait.has(r.trait_key)) modByTrait.set(r.trait_key, []);
		modByTrait.get(r.trait_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	return traits.map((t) => ({ ...t, modifiers: modByTrait.get(t.key) ?? [] }));
}
