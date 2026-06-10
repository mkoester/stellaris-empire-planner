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

export interface PolicyRestriction {
	policyKey: string;
	optionKey: string;
	optionLabel: string | null;
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
	policyRestrictions: PolicyRestriction[];
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

	const prRows = db()
		.prepare(
			`SELECT ethic_key, policy_key, option_key, option_label
			 FROM ethic_policy_restriction
			 ORDER BY ethic_key, policy_key, option_key`
		)
		.all() as Array<{
		ethic_key: string;
		policy_key: string;
		option_key: string;
		option_label: string | null;
	}>;

	const prByEthic = new Map<string, PolicyRestriction[]>();
	for (const r of prRows) {
		if (!prByEthic.has(r.ethic_key)) prByEthic.set(r.ethic_key, []);
		prByEthic.get(r.ethic_key)!.push({
			policyKey: r.policy_key,
			optionKey: r.option_key,
			optionLabel: r.option_label
		});
	}

	return rows.map((r) => ({
		key: r.key,
		label: r.label,
		cost: r.cost,
		gestalt: r.gestalt === 1,
		fanatic_variant: r.fanatic_variant,
		regular_variant: r.regular_variant,
		modifiers: modByEthic.get(r.key) ?? [],
		implications: tagsByEthic.get(r.key) ?? [],
		policyRestrictions: prByEthic.get(r.key) ?? []
	}));
}

// ── Precursors ─────────────────────────────────────────────────────────────

export interface RelicModifier extends Modifier {
	condition: string | null; // null = always applies; else e.g. "is_machine_empire = yes"
}

export interface PrecursorRelic {
	relicKey: string;
	name: string | null;
	portrait: string | null;
	score: number | null;
	description: string | null;
	activeEffect: string | null;
	passives: RelicModifier[]; // triggered_country_modifier effects
}

export interface PrecursorReward {
	staticModifier: string;
	variant: string;
	name: string | null;
	modifiers: Modifier[];
}

export interface PrecursorBuilding {
	buildingKey: string;
	name: string | null;
	scope: string | null; // "planet" | "starbase"
}

export interface DepositResource {
	kind: string; // "produces" | "cost" | "upkeep"
	resource: string;
	amount: number;
}

export interface PlanetDeposit {
	depositKey: string;
	name: string | null;
	isBlocker: boolean;
	resources: DepositResource[];
}

export interface PrecursorPlanet {
	id: string;
	name: string | null;
	planetClass: string | null;
	planetClassLabel: string | null;
	size: number | null;
	isMoon: boolean;
	isHomeworld: boolean;
	deposits: PlanetDeposit[];
	modifiers: Modifier[];
}

export interface PrecursorMegastructure {
	type: string;
	label: string | null;
	count: number;
}

export interface PrecursorSystem {
	initializer: string;
	name: string | null;
	starClass: string | null;
	planets: PrecursorPlanet[];
	megastructures: PrecursorMegastructure[];
}

export interface Precursor {
	key: string;
	name: string | null;
	requiredDlc: string | null;
	picture: string | null;
	numDigsites: number | null;
	relic: PrecursorRelic | null;
	rewards: PrecursorReward[];
	buildings: PrecursorBuilding[];
	systems: PrecursorSystem[];
}

export function loadPrecursors(): Precursor[] {
	const d = db();

	const baseRows = d
		.prepare(
			`SELECT key, name, required_dlc, picture, num_digsites
			 FROM precursor ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		required_dlc: string | null;
		picture: string | null;
		num_digsites: number | null;
	}>;

	// ── Relics (0..1 per precursor) + their passive modifiers ──
	const relicRows = d
		.prepare(
			`SELECT precursor_key, relic_key, name, portrait, score, description, active_effect
			 FROM precursor_relic`
		)
		.all() as Array<{
		precursor_key: string;
		relic_key: string;
		name: string | null;
		portrait: string | null;
		score: number | null;
		description: string | null;
		active_effect: string | null;
	}>;

	const relicModRows = d
		.prepare(
			`SELECT rm.relic_key, rm.modifier_key, rm.modifier_value, rm.condition,
			        ml.label, ml.positive_is_good
			 FROM precursor_relic_modifier rm
			 LEFT JOIN modifier_label ml ON ml.modifier_key = rm.modifier_key
			 ORDER BY rm.relic_key, rm.sort_order`
		)
		.all() as Array<{
		relic_key: string;
		modifier_key: string;
		modifier_value: number;
		condition: string | null;
		label: string | null;
		positive_is_good: number | null;
	}>;

	const passivesByRelic = new Map<string, RelicModifier[]>();
	for (const r of relicModRows) {
		if (!passivesByRelic.has(r.relic_key)) passivesByRelic.set(r.relic_key, []);
		passivesByRelic.get(r.relic_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0,
			condition: r.condition
		});
	}

	const relicByPrecursor = new Map<string, PrecursorRelic>();
	for (const r of relicRows) {
		relicByPrecursor.set(r.precursor_key, {
			relicKey: r.relic_key,
			name: r.name,
			portrait: r.portrait,
			score: r.score,
			description: r.description,
			activeEffect: r.active_effect,
			passives: passivesByRelic.get(r.relic_key) ?? []
		});
	}

	// ── Reward modifiers (the permanent empire effect), grouped by variant ──
	const rewardRows = d
		.prepare(
			`SELECT prm.precursor_key, prm.static_modifier, prm.variant, prm.name,
			        prm.modifier_key, prm.modifier_value, ml.label, ml.positive_is_good
			 FROM precursor_reward_modifier prm
			 LEFT JOIN modifier_label ml ON ml.modifier_key = prm.modifier_key
			 ORDER BY prm.precursor_key, prm.variant, prm.sort_order`
		)
		.all() as Array<{
		precursor_key: string;
		static_modifier: string;
		variant: string;
		name: string | null;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;

	const rewardsByPrecursor = new Map<string, Map<string, PrecursorReward>>();
	for (const r of rewardRows) {
		if (!rewardsByPrecursor.has(r.precursor_key))
			rewardsByPrecursor.set(r.precursor_key, new Map());
		const byVariant = rewardsByPrecursor.get(r.precursor_key)!;
		if (!byVariant.has(r.static_modifier)) {
			byVariant.set(r.static_modifier, {
				staticModifier: r.static_modifier,
				variant: r.variant,
				name: r.name,
				modifiers: []
			});
		}
		byVariant.get(r.static_modifier)!.modifiers.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	// ── Buildings ──
	const buildingRows = d
		.prepare(`SELECT precursor_key, building_key, name, scope FROM precursor_building`)
		.all() as Array<{
		precursor_key: string;
		building_key: string;
		name: string | null;
		scope: string | null;
	}>;
	const buildingsByPrecursor = new Map<string, PrecursorBuilding[]>();
	for (const r of buildingRows) {
		if (!buildingsByPrecursor.has(r.precursor_key)) buildingsByPrecursor.set(r.precursor_key, []);
		buildingsByPrecursor.get(r.precursor_key)!.push({
			buildingKey: r.building_key,
			name: r.name,
			scope: r.scope
		});
	}

	// ── Systems → planets → deposits / modifiers, + megastructures ──
	const sysRows = d
		.prepare(
			`SELECT precursor_key, initializer, name, star_class
			 FROM precursor_system ORDER BY precursor_key, sort_order`
		)
		.all() as Array<{
		precursor_key: string;
		initializer: string;
		name: string | null;
		star_class: string | null;
	}>;

	const planetRows = d
		.prepare(
			`SELECT id, precursor_key, initializer, name, planet_class, planet_class_label,
			        size, is_moon, is_homeworld
			 FROM precursor_planet ORDER BY initializer, sort_order`
		)
		.all() as Array<{
		id: string;
		precursor_key: string;
		initializer: string;
		name: string | null;
		planet_class: string | null;
		planet_class_label: string | null;
		size: number | null;
		is_moon: number;
		is_homeworld: number;
	}>;

	// Planet deposits joined to the deposit dictionary (+ its resource yields).
	const planetDepRows = d
		.prepare(
			`SELECT ppd.planet_id, ppd.deposit_key, dep.name, dep.is_blocker, ppd.sort_order
			 FROM precursor_planet_deposit ppd
			 LEFT JOIN deposit dep ON dep.key = ppd.deposit_key
			 ORDER BY ppd.planet_id, ppd.sort_order`
		)
		.all() as Array<{
		planet_id: string;
		deposit_key: string;
		name: string | null;
		is_blocker: number | null;
		sort_order: number;
	}>;

	const depResRows = d
		.prepare(`SELECT deposit_key, kind, resource, amount FROM deposit_resource`)
		.all() as Array<{ deposit_key: string; kind: string; resource: string; amount: number }>;
	const resByDeposit = new Map<string, DepositResource[]>();
	for (const r of depResRows) {
		if (!resByDeposit.has(r.deposit_key)) resByDeposit.set(r.deposit_key, []);
		resByDeposit.get(r.deposit_key)!.push({ kind: r.kind, resource: r.resource, amount: r.amount });
	}

	const depositsByPlanet = new Map<string, PlanetDeposit[]>();
	for (const r of planetDepRows) {
		if (!depositsByPlanet.has(r.planet_id)) depositsByPlanet.set(r.planet_id, []);
		depositsByPlanet.get(r.planet_id)!.push({
			depositKey: r.deposit_key,
			name: r.name,
			isBlocker: r.is_blocker === 1,
			resources: resByDeposit.get(r.deposit_key) ?? []
		});
	}

	const planetModRows = d
		.prepare(
			`SELECT ppm.planet_id, ppm.modifier_key, ppm.modifier_value, ml.label, ml.positive_is_good
			 FROM precursor_planet_modifier ppm
			 LEFT JOIN modifier_label ml ON ml.modifier_key = ppm.modifier_key`
		)
		.all() as Array<{
		planet_id: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const modsByPlanet = new Map<string, Modifier[]>();
	for (const r of planetModRows) {
		if (!modsByPlanet.has(r.planet_id)) modsByPlanet.set(r.planet_id, []);
		modsByPlanet.get(r.planet_id)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	const planetsByInitializer = new Map<string, PrecursorPlanet[]>();
	for (const r of planetRows) {
		if (!planetsByInitializer.has(r.initializer)) planetsByInitializer.set(r.initializer, []);
		planetsByInitializer.get(r.initializer)!.push({
			id: r.id,
			name: r.name,
			planetClass: r.planet_class,
			planetClassLabel: r.planet_class_label,
			size: r.size,
			isMoon: r.is_moon === 1,
			isHomeworld: r.is_homeworld === 1,
			deposits: depositsByPlanet.get(r.id) ?? [],
			modifiers: modsByPlanet.get(r.id) ?? []
		});
	}

	const megaRows = d
		.prepare(
			`SELECT precursor_key, initializer, type, type_label, count FROM precursor_megastructure`
		)
		.all() as Array<{
		precursor_key: string;
		initializer: string;
		type: string;
		type_label: string | null;
		count: number;
	}>;
	const megaByInitializer = new Map<string, PrecursorMegastructure[]>();
	for (const r of megaRows) {
		if (!megaByInitializer.has(r.initializer)) megaByInitializer.set(r.initializer, []);
		megaByInitializer
			.get(r.initializer)!
			.push({ type: r.type, label: r.type_label, count: r.count });
	}

	const systemsByPrecursor = new Map<string, PrecursorSystem[]>();
	for (const r of sysRows) {
		if (!systemsByPrecursor.has(r.precursor_key)) systemsByPrecursor.set(r.precursor_key, []);
		systemsByPrecursor.get(r.precursor_key)!.push({
			initializer: r.initializer,
			name: r.name,
			starClass: r.star_class,
			planets: planetsByInitializer.get(r.initializer) ?? [],
			megastructures: megaByInitializer.get(r.initializer) ?? []
		});
	}

	return baseRows.map((r) => ({
		key: r.key,
		name: r.name,
		requiredDlc: r.required_dlc,
		picture: r.picture,
		numDigsites: r.num_digsites,
		relic: relicByPrecursor.get(r.key) ?? null,
		rewards: [...(rewardsByPrecursor.get(r.key)?.values() ?? [])],
		buildings: buildingsByPrecursor.get(r.key) ?? [],
		systems: systemsByPrecursor.get(r.key) ?? []
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
