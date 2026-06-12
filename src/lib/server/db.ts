import Database from 'better-sqlite3';
import { STELLARIS_DB } from '$env/static/private';

let _db: Database.Database | null = null;

function db(): Database.Database {
	if (!_db) {
		_db = new Database(STELLARIS_DB, { readonly: true, fileMustExist: true });
	}
	return _db;
}

export interface GameVersion {
	version: string; // full, e.g. "Cetus v4.3.7 (4f3c)"
	raw: string | null; // e.g. "v4.3.7"
}

// The Stellaris version the DB was extracted from (meta, from launcher-settings.json).
export function loadGameVersion(): GameVersion | null {
	const rows = db()
		.prepare(`SELECT key, value FROM meta WHERE key IN ('game_version', 'game_version_raw')`)
		.all() as Array<{ key: string; value: string }>;
	const map = new Map(rows.map((x) => [x.key, x.value]));
	const version = map.get('game_version');
	if (!version) return null;
	return { version, raw: map.get('game_version_raw') ?? null };
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

// ── Civics ───────────────────────────────────────────────────────────────────

// One eligibility rule parsed from a civic's potential/possible blocks. `kind` is
// what is constrained (authority/ethic/civic/origin); `operator` is 'require',
// 'forbid', or 'require_any' (one of an OR set, tied together by `groupId`).
export interface CivicRequirement {
	kind: string;
	operator: string;
	value: string;
	groupId: number;
}

export interface Civic {
	key: string;
	name: string | null;
	description: string | null;
	civicType: string; // 'normal' | 'gestalt' | 'corporate' | 'special'
	requiredDlc: string | null;
	icon: string | null;
	modifiers: Modifier[];
	requirements: CivicRequirement[];
}

// Player-selectable civics (skips non-pickable ones gated to fallen empires etc.),
// with their numeric modifiers and parsed eligibility rules.
export function loadCivics(): Civic[] {
	const d = db();
	const rows = d
		.prepare(
			`SELECT key, name, description, civic_type, required_dlc, icon
			 FROM civic WHERE selectable = 1 ORDER BY civic_type, sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		civic_type: string;
		required_dlc: string | null;
		icon: string | null;
	}>;

	const modRows = d
		.prepare(
			`SELECT cm.civic_key, cm.modifier_key, cm.modifier_value, ml.label, ml.positive_is_good
			 FROM civic_modifier cm
			 LEFT JOIN modifier_label ml ON ml.modifier_key = cm.modifier_key
			 ORDER BY cm.civic_key, cm.sort_order`
		)
		.all() as Array<{
		civic_key: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const modByCivic = new Map<string, Modifier[]>();
	for (const r of modRows) {
		if (!modByCivic.has(r.civic_key)) modByCivic.set(r.civic_key, []);
		modByCivic.get(r.civic_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	const reqRows = d
		.prepare(
			`SELECT civic_key, kind, operator, value, group_id
			 FROM civic_requirement ORDER BY civic_key, kind, operator`
		)
		.all() as Array<{
		civic_key: string;
		kind: string;
		operator: string;
		value: string;
		group_id: number;
	}>;
	const reqByCivic = new Map<string, CivicRequirement[]>();
	for (const r of reqRows) {
		if (!reqByCivic.has(r.civic_key)) reqByCivic.set(r.civic_key, []);
		reqByCivic.get(r.civic_key)!.push({
			kind: r.kind,
			operator: r.operator,
			value: r.value,
			groupId: r.group_id
		});
	}

	return rows.map((r) => ({
		key: r.key,
		name: r.name,
		description: r.description,
		civicType: r.civic_type,
		requiredDlc: r.required_dlc,
		icon: r.icon,
		modifiers: modByCivic.get(r.key) ?? [],
		requirements: reqByCivic.get(r.key) ?? []
	}));
}

// ── Origins ──────────────────────────────────────────────────────────────────

// The empire's starting scenario. Same requirement shape as civics (reuses
// CivicRequirement); most origins' real effects are narrative — `description` is the
// main payload, with `modifiers[]` where the origin has numeric effects.
export interface Origin {
	key: string;
	name: string | null;
	description: string | null;
	requiredDlc: string | null;
	icon: string | null;
	modifiers: Modifier[];
	requirements: CivicRequirement[];
}

export function loadOrigins(): Origin[] {
	const d = db();
	const rows = d
		.prepare(
			`SELECT key, name, description, required_dlc, icon
			 FROM origin WHERE selectable = 1 ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		required_dlc: string | null;
		icon: string | null;
	}>;

	const modRows = d
		.prepare(
			`SELECT om.origin_key, om.modifier_key, om.modifier_value, ml.label, ml.positive_is_good
			 FROM origin_modifier om
			 LEFT JOIN modifier_label ml ON ml.modifier_key = om.modifier_key
			 ORDER BY om.origin_key, om.sort_order`
		)
		.all() as Array<{
		origin_key: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const modByOrigin = new Map<string, Modifier[]>();
	for (const r of modRows) {
		if (!modByOrigin.has(r.origin_key)) modByOrigin.set(r.origin_key, []);
		modByOrigin.get(r.origin_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	const reqRows = d
		.prepare(
			`SELECT origin_key, kind, operator, value, group_id
			 FROM origin_requirement ORDER BY origin_key, kind, operator`
		)
		.all() as Array<{
		origin_key: string;
		kind: string;
		operator: string;
		value: string;
		group_id: number;
	}>;
	const reqByOrigin = new Map<string, CivicRequirement[]>();
	for (const r of reqRows) {
		if (!reqByOrigin.has(r.origin_key)) reqByOrigin.set(r.origin_key, []);
		reqByOrigin.get(r.origin_key)!.push({
			kind: r.kind,
			operator: r.operator,
			value: r.value,
			groupId: r.group_id
		});
	}

	return rows.map((r) => ({
		key: r.key,
		name: r.name,
		description: r.description,
		requiredDlc: r.required_dlc,
		icon: r.icon,
		modifiers: modByOrigin.get(r.key) ?? [],
		requirements: reqByOrigin.get(r.key) ?? []
	}));
}

// ── Planet classes ───────────────────────────────────────────────────────────

// A world type. `climate` (wet/dry/cold) groups habitability for the colonizable
// standard climates; special/engineered worlds and uninhabitable bodies have none.
export interface PlanetClass {
	key: string;
	name: string | null;
	climate: string | null;
	colonizable: boolean;
	isStandard: boolean; // a default startable climate (initial = yes)
}

export function loadPlanetClasses(): PlanetClass[] {
	const rows = db()
		.prepare(
			`SELECT key, name, climate, colonizable, is_standard
			 FROM planet_class ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		climate: string | null;
		colonizable: number;
		is_standard: number;
	}>;
	return rows.map((r) => ({
		key: r.key,
		name: r.name,
		climate: r.climate,
		colonizable: r.colonizable === 1,
		isStandard: r.is_standard === 1
	}));
}

// ── Precursors ─────────────────────────────────────────────────────────────

export interface RelicModifier extends Modifier {
	condition: string | null; // null = always applies; else e.g. "is_machine_empire = yes"
}

export interface RelicResource {
	resource: string;
	amount: number;
	scales: boolean; // grows with each use (a multiplier, e.g. Cybrex cybrex_count)
}

export interface RelicPassiveText {
	text: string;
	condition: string | null; // null = always; else e.g. "is_wilderness_empire = yes"
}

export interface ActiveModifier extends Modifier {
	groupLabel: string | null; // for 'choice' actives: the option name (e.g. "Martial Guidance")
}

export interface PrecursorRelic {
	relicKey: string;
	name: string | null;
	portrait: string | null;
	score: number | null;
	description: string | null;
	passiveTexts: RelicPassiveText[]; // non-numeric passives (e.g. Cybrex Warform armies), w/ condition
	activeEffect: string | null; // triumph (active) ability text
	activeMode: string | null; // 'direct' | 'random' | 'choice'
	activeDetail: string | null; // how active modifiers are granted (e.g. "one at random for 2–5 years…")
	triumphCooldownDays: number | null;
	passives: RelicModifier[]; // triggered_country_modifier numeric effects
	activeModifiers: ActiveModifier[]; // temporary modifiers the triumph can grant (grouped for 'choice')
	costs: RelicResource[]; // triumph activation cost (resources spent)
	produces: RelicResource[]; // triumph payout (resources gained)
}

export interface PrecursorReward {
	staticModifier: string;
	variant: string;
	name: string | null;
	modifiers: Modifier[];
}

export interface BuildingResource {
	kind: string; // "cost" | "upkeep" | "produces"
	resource: string;
	amount: number;
}

// A building modifier, tagged with where it applies (`buildingScope`): 'job' =
// jobs the building adds (job_<x>_add), 'planet' = planet_modifier, 'country' =
// country_modifier, 'system'/'station' = an orbital starbase building's system/
// station modifier. `value` is the base (no-perk) value; `aeValue` is the total
// with the Archaeo-Engineers ascension perk (null when the perk makes no
// difference). `condition` is null normally, or a *different* required ascension
// perk's key (e.g. 'ap_cosmogenesis') when the modifier only applies with it.
export interface BuildingModifier extends Modifier {
	buildingScope: string;
	aeValue: number | null;
	condition: string | null;
}

export interface PrecursorBuilding {
	buildingKey: string;
	name: string | null;
	scope: string | null; // "planet" | "starbase"
	source: string; // "homeworld" | "technology"
	techKey: string | null; // unlocking tech (source = "technology")
	category: string | null;
	buildTimeDays: number | null;
	empireLimit: number | null; // max per empire (base_cap_amount); null = uncapped
	planetLimit: number | null; // max per planet (planet_limit); null = uncapped
	canDemolish: boolean | null;
	resources: BuildingResource[];
	modifiers: BuildingModifier[];
}

// A precursor's "Secrets of …" technology, granted by the discovery special
// project, which unlocks an empire-wide building (unlocksBuildingKey).
export interface PrecursorTechnology {
	techKey: string;
	name: string | null;
	cost: number | null;
	tier: number | null;
	area: string | null;
	category: string | null;
	unlocksBuildingKey: string | null;
}

// The one-time reward for discovering the precursor home world. A scaled resource
// burst has `multiplier` set (× the empire's current monthly output of `resource`,
// clamped to [minAmount, maxAmount]); the flat minor-artifacts payout has
// `multiplier === null` (minAmount/maxAmount are the random bounds, e.g. 750–1500).
export interface PrecursorHomeworldReward {
	resource: string;
	multiplier: number | null;
	minAmount: number;
	maxAmount: number;
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
	technology: PrecursorTechnology | null;
	homeworldRewards: PrecursorHomeworldReward[];
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
			`SELECT precursor_key, relic_key, name, portrait, score, description,
			        active_effect, active_mode, active_detail, triumph_cooldown_days
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
		active_mode: string | null;
		active_detail: string | null;
		triumph_cooldown_days: number | null;
	}>;

	const passiveTextRows = d
		.prepare(
			`SELECT relic_key, text, condition
			 FROM precursor_relic_passive_text ORDER BY relic_key, sort_order`
		)
		.all() as Array<{ relic_key: string; text: string; condition: string | null }>;
	const passiveTextsByRelic = new Map<string, RelicPassiveText[]>();
	for (const r of passiveTextRows) {
		if (!passiveTextsByRelic.has(r.relic_key)) passiveTextsByRelic.set(r.relic_key, []);
		passiveTextsByRelic.get(r.relic_key)!.push({ text: r.text, condition: r.condition });
	}

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

	const resourceRows = d
		.prepare(
			`SELECT relic_key, kind, resource, amount, scales
			 FROM precursor_relic_resource ORDER BY relic_key, kind, sort_order`
		)
		.all() as Array<{
		relic_key: string;
		kind: string;
		resource: string;
		amount: number;
		scales: number;
	}>;
	const costsByRelic = new Map<string, RelicResource[]>();
	const producesByRelic = new Map<string, RelicResource[]>();
	for (const r of resourceRows) {
		const target = r.kind === 'produces' ? producesByRelic : costsByRelic;
		if (!target.has(r.relic_key)) target.set(r.relic_key, []);
		target.get(r.relic_key)!.push({
			resource: r.resource,
			amount: r.amount,
			scales: r.scales === 1
		});
	}

	const activeModRows = d
		.prepare(
			`SELECT am.relic_key, am.modifier_key, am.modifier_value, am.group_label,
			        ml.label, ml.positive_is_good
			 FROM precursor_relic_active_modifier am
			 LEFT JOIN modifier_label ml ON ml.modifier_key = am.modifier_key
			 ORDER BY am.relic_key, am.sort_order`
		)
		.all() as Array<{
		relic_key: string;
		modifier_key: string;
		modifier_value: number;
		group_label: string | null;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const activeModsByRelic = new Map<string, ActiveModifier[]>();
	for (const r of activeModRows) {
		if (!activeModsByRelic.has(r.relic_key)) activeModsByRelic.set(r.relic_key, []);
		activeModsByRelic.get(r.relic_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0,
			groupLabel: r.group_label
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
			passiveTexts: passiveTextsByRelic.get(r.relic_key) ?? [],
			activeEffect: r.active_effect,
			activeMode: r.active_mode,
			activeDetail: r.active_detail,
			triumphCooldownDays: r.triumph_cooldown_days,
			passives: passivesByRelic.get(r.relic_key) ?? [],
			activeModifiers: activeModsByRelic.get(r.relic_key) ?? [],
			costs: costsByRelic.get(r.relic_key) ?? [],
			produces: producesByRelic.get(r.relic_key) ?? []
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

	// ── Buildings (+ their resources / jobs / modifiers) ──
	const buildingResRows = d
		.prepare(
			`SELECT building_key, kind, resource, amount
			 FROM precursor_building_resource ORDER BY building_key, kind, sort_order`
		)
		.all() as Array<{ building_key: string; kind: string; resource: string; amount: number }>;
	const resByBuilding = new Map<string, BuildingResource[]>();
	for (const r of buildingResRows) {
		if (!resByBuilding.has(r.building_key)) resByBuilding.set(r.building_key, []);
		resByBuilding
			.get(r.building_key)!
			.push({ kind: r.kind, resource: r.resource, amount: r.amount });
	}

	const buildingModRows = d
		.prepare(
			`SELECT bm.building_key, bm.scope, bm.modifier_key, bm.modifier_value, bm.ae_value,
			        bm.condition, ml.label, ml.positive_is_good
			 FROM precursor_building_modifier bm
			 LEFT JOIN modifier_label ml ON ml.modifier_key = bm.modifier_key
			 ORDER BY bm.building_key, bm.scope, bm.sort_order`
		)
		.all() as Array<{
		building_key: string;
		scope: string;
		modifier_key: string;
		modifier_value: number;
		ae_value: number | null;
		condition: string | null;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const modsByBuilding = new Map<string, BuildingModifier[]>();
	for (const r of buildingModRows) {
		if (!modsByBuilding.has(r.building_key)) modsByBuilding.set(r.building_key, []);
		modsByBuilding.get(r.building_key)!.push({
			buildingScope: r.scope,
			aeValue: r.ae_value,
			condition: r.condition,
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	const buildingRows = d
		.prepare(
			`SELECT precursor_key, building_key, name, scope, source, tech_key, category,
			        build_time_days, empire_limit, planet_limit, can_demolish
			 FROM precursor_building`
		)
		.all() as Array<{
		precursor_key: string;
		building_key: string;
		name: string | null;
		scope: string | null;
		source: string;
		tech_key: string | null;
		category: string | null;
		build_time_days: number | null;
		empire_limit: number | null;
		planet_limit: number | null;
		can_demolish: number | null;
	}>;
	const buildingsByPrecursor = new Map<string, PrecursorBuilding[]>();
	for (const r of buildingRows) {
		if (!buildingsByPrecursor.has(r.precursor_key)) buildingsByPrecursor.set(r.precursor_key, []);
		buildingsByPrecursor.get(r.precursor_key)!.push({
			buildingKey: r.building_key,
			name: r.name,
			scope: r.scope,
			source: r.source,
			techKey: r.tech_key,
			category: r.category,
			buildTimeDays: r.build_time_days,
			empireLimit: r.empire_limit,
			planetLimit: r.planet_limit,
			canDemolish: r.can_demolish === null ? null : r.can_demolish === 1,
			resources: resByBuilding.get(r.building_key) ?? [],
			modifiers: modsByBuilding.get(r.building_key) ?? []
		});
	}

	// ── Technologies ("Secrets of …" → unlocked building) ──
	const techRows = d
		.prepare(
			`SELECT precursor_key, tech_key, name, cost, tier, area, category, unlocks_building_key
			 FROM precursor_technology ORDER BY precursor_key`
		)
		.all() as Array<{
		precursor_key: string;
		tech_key: string;
		name: string | null;
		cost: number | null;
		tier: number | null;
		area: string | null;
		category: string | null;
		unlocks_building_key: string | null;
	}>;
	const technologyByPrecursor = new Map<string, PrecursorTechnology>();
	for (const r of techRows) {
		technologyByPrecursor.set(r.precursor_key, {
			techKey: r.tech_key,
			name: r.name,
			cost: r.cost,
			tier: r.tier,
			area: r.area,
			category: r.category,
			unlocksBuildingKey: r.unlocks_building_key
		});
	}

	// ── Home-world discovery rewards (resource bursts + minor artifacts) ──
	const hwRewardRows = d
		.prepare(
			`SELECT precursor_key, resource, multiplier, min_amount, max_amount
			 FROM precursor_homeworld_reward ORDER BY precursor_key, sort_order`
		)
		.all() as Array<{
		precursor_key: string;
		resource: string;
		multiplier: number | null;
		min_amount: number;
		max_amount: number;
	}>;
	const homeworldRewardsByPrecursor = new Map<string, PrecursorHomeworldReward[]>();
	for (const r of hwRewardRows) {
		if (!homeworldRewardsByPrecursor.has(r.precursor_key))
			homeworldRewardsByPrecursor.set(r.precursor_key, []);
		homeworldRewardsByPrecursor.get(r.precursor_key)!.push({
			resource: r.resource,
			multiplier: r.multiplier,
			minAmount: r.min_amount,
			maxAmount: r.max_amount
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
		technology: technologyByPrecursor.get(r.key) ?? null,
		homeworldRewards: homeworldRewardsByPrecursor.get(r.key) ?? [],
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
