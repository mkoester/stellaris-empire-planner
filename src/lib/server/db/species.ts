// Species classes, archetypes, portraits, traits.
import { db } from './client';
import type { Modifier, ScalingModifier } from './types';

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
	baseTrait: string | null; // the class's own auto-included base trait (e.g. INF → trait_infernal)
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
			`SELECT key, label, archetype, base_trait FROM species_class
			 WHERE label IS NOT NULL AND archetype IN ('BIOLOGICAL', 'LITHOID', 'MACHINE')
			 ORDER BY archetype, label`
		)
		.all() as Array<{
		key: string;
		label: string;
		archetype: string;
		base_trait: string | null;
	}>;
	return rows.map((r) => ({
		key: r.key,
		label: r.label,
		archetype: r.archetype,
		baseTrait: r.base_trait
	}));
}

// ── Portraits ────────────────────────────────────────────────────────────────
// Each portrait belongs to one or more species classes (via common/portrait_sets);
// the class is what gates the phenotype-specific traits you may pick. We surface the
// portraits selectable at empire creation and, per portrait, the playable classes it
// belongs to plus the traits each of those classes unlocks. Most portraits map to one
// class; the Machine + Robot synth portraits are the notable multi-class case.
export interface PortraitClassInfo {
	key: string;
	label: string;
	traitKeys: string[]; // traits gated to this class (trait_species_class)
}
export interface PortraitInfo {
	id: string;
	classes: PortraitClassInfo[]; // playable classes it belongs to (sorted by label)
	bonusTraitKeys: string[]; // cross-phenotype traits this specific portrait may also pick
	// (the trait's `portrait_override`), beyond what its class already grants
	requiredDlc: string[];
}

export function loadPortraits(): PortraitInfo[] {
	const d = db();
	// Playable classes → label + class-gated traits.
	const classInfo = new Map<string, PortraitClassInfo>();
	for (const r of d
		.prepare(`SELECT key, COALESCE(label, key) AS label FROM species_class WHERE playable = 1`)
		.all() as Array<{ key: string; label: string }>) {
		classInfo.set(r.key, { key: r.key, label: r.label, traitKeys: [] });
	}
	for (const r of d
		.prepare(`SELECT species_class_key, trait_key FROM trait_species_class ORDER BY trait_key`)
		.all() as Array<{ species_class_key: string; trait_key: string }>) {
		classInfo.get(r.species_class_key)?.traitKeys.push(r.trait_key);
	}
	// portrait_id → traits that explicitly list it in `portrait_override` (cross-class access).
	const overrideByPortrait = new Map<string, string[]>();
	for (const r of d
		.prepare(`SELECT portrait_id, trait_key FROM trait_portrait_override ORDER BY trait_key`)
		.all() as Array<{ portrait_id: string; trait_key: string }>) {
		(
			overrideByPortrait.get(r.portrait_id) ??
			overrideByPortrait.set(r.portrait_id, []).get(r.portrait_id)!
		).push(r.trait_key);
	}
	// Portraits selectable at empire creation: a selectable row in a playable class.
	const byPortrait = new Map<string, { classes: Set<string>; dlc: Set<string> }>();
	for (const r of d
		.prepare(
			`SELECT ps.portrait_id, ps.species_class_key, ps.required_dlc
			 FROM portrait_set ps
			 JOIN species_class sc ON sc.key = ps.species_class_key
			 WHERE ps.selectable = 1 AND sc.playable = 1`
		)
		.all() as Array<{
		portrait_id: string;
		species_class_key: string;
		required_dlc: string | null;
	}>) {
		let e = byPortrait.get(r.portrait_id);
		if (!e) {
			e = { classes: new Set(), dlc: new Set() };
			byPortrait.set(r.portrait_id, e);
		}
		e.classes.add(r.species_class_key);
		if (r.required_dlc) e.dlc.add(r.required_dlc);
	}
	const out: PortraitInfo[] = [];
	for (const [id, e] of byPortrait) {
		const classes = [...e.classes]
			.map((k) => classInfo.get(k)!)
			.sort((a, b) => a.label.localeCompare(b.label));
		// Bonus = override traits this portrait's own class(es) don't already grant.
		const classTraits = new Set(classes.flatMap((c) => c.traitKeys));
		const bonusTraitKeys = (overrideByPortrait.get(id) ?? []).filter((t) => !classTraits.has(t));
		out.push({ id, classes, bonusTraitKeys, requiredDlc: [...e.dlc].sort() });
	}
	return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function loadTraitsForKeys(keys: string[]): Trait[] {
	if (keys.length === 0) return [];
	const ph = keys.map(() => '?').join(',');
	const rows = db()
		.prepare(
			`SELECT
				t.key, t.cost, t.category, t.initial, t.hidden, t.required_dlc, t.description, t.effect,
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
		description: string | null;
		effect: string | null;
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
		description: r.description,
		effect: r.effect,
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

	const scaling = scalingModifiersByTrait(keys);
	return traits.map((t) => ({
		...t,
		modifiers: modByTrait.get(t.key) ?? [],
		scalingModifiers: scaling.get(t.key) ?? []
	}));
}

// Per-pop-count scaling effects keyed by trait (Familial, Noxious), joined to modifier_label.
export function scalingModifiersByTrait(keys?: string[]): Map<string, ScalingModifier[]> {
	const where =
		keys && keys.length ? `WHERE sm.trait_key IN (${keys.map(() => '?').join(',')})` : '';
	const rows = db()
		.prepare(
			`SELECT sm.trait_key, sm.modifier_key, sm.rate, sm.cap, sm.unit,
			        ml.label, ml.positive_is_good
			 FROM trait_scaling_modifier sm
			 LEFT JOIN modifier_label ml ON ml.modifier_key = sm.modifier_key
			 ${where}
			 ORDER BY sm.trait_key, sm.sort_order`
		)
		.all(...(keys ?? [])) as Array<{
		trait_key: string;
		modifier_key: string;
		rate: number;
		cap: number | null;
		unit: string;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const m = new Map<string, ScalingModifier[]>();
	for (const r of rows) {
		if (!m.has(r.trait_key)) m.set(r.trait_key, []);
		m.get(r.trait_key)!.push({
			key: r.modifier_key,
			rate: r.rate,
			cap: r.cap,
			unit: r.unit,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}
	return m;
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
	scalingModifiers: ScalingModifier[]; // scaling effects (Familial, Noxious, Genetic Memory)
	description: string | null; // cleaned flavour text from trait_<key>_desc
	effect: string | null; // non-numeric behavioural lines from custom_tooltip (e.g. Rooted's "Pops will not Automatically Resettle")
}

// trait key → point cost, for the empire overviews to colour negative (drawback) traits.
export function loadTraitCosts(): Record<string, number> {
	const out: Record<string, number> = {};
	for (const r of db()
		.prepare('SELECT key, cost FROM trait WHERE cost IS NOT NULL')
		.all() as Array<{ key: string; cost: number }>) {
		out[r.key] = r.cost;
	}
	return out;
}

// species class key → its auto-included base trait. Each class declares its own `trait`
// (HUM→trait_organic, INF/Thermophile→trait_infernal, LITHOID→trait_lithoid, MACHINE→
// trait_machine_unit), which is authoritative; fall back to the archetype default for any
// class that doesn't. So the overviews show the base trait the builder includes implicitly.
export function loadBaseTraitByClass(): Record<string, string> {
	const d = db();
	const archBase: Record<string, string> = {};
	for (const r of d
		.prepare('SELECT key, base_trait FROM species_archetype WHERE base_trait IS NOT NULL')
		.all() as Array<{ key: string; base_trait: string }>) {
		archBase[r.key] = r.base_trait;
	}
	const out: Record<string, string> = {};
	for (const r of d.prepare('SELECT key, archetype, base_trait FROM species_class').all() as Array<{
		key: string;
		archetype: string | null;
		base_trait: string | null;
	}>) {
		const bt = r.base_trait ?? (r.archetype ? archBase[r.archetype] : undefined);
		if (bt) out[r.key] = bt;
	}
	return out;
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
			t.description,
			t.effect,
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
		description: string | null;
		effect: string | null;
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
		description: r.description,
		effect: r.effect,
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

	const scaling = scalingModifiersByTrait();
	return traits.map((t) => ({
		...t,
		modifiers: modByTrait.get(t.key) ?? [],
		scalingModifiers: scaling.get(t.key) ?? []
	}));
}
