// Aggregate the numeric effects of an empire's choices into source-tagged lists for
// the Empire page's "Effects" block. Empire-wide picks (ethics/civics/origin) are
// grouped by theme; species traits are kept separate, grouped per species, since a
// trait only affects that species' own pops. Pure data → display logic, unit-tested.
import type { Modifier, ModifierSource, ScalingModifier } from '$lib/server/db';
import { keyName } from './empireFile';

export interface EffectEntry {
	sourceKind: ModifierSource['kind']; // "ethic" | "civic" | "origin" | "trait"
	sourceName: string; // resolved display name of the choice it comes from
	mod: Modifier;
	scaling?: ScalingModifier; // set for count-scaled effects (Familial/Genetic Memory); render via formatScalingModifier
}

interface EffectDraft {
	ethics: string[];
	authority?: string | null;
	civics: string[];
	origin: string | null;
}

// Resolve a list of keys into effect rows (one per modifier), in the given order.
function rowsFor(
	keys: string[],
	index: Record<string, ModifierSource>,
	names: Record<string, string>
): EffectEntry[] {
	const out: EffectEntry[] = [];
	for (const key of keys) {
		const src = index[key];
		if (!src) continue;
		const sourceName = keyName(key, names);
		for (const mod of src.modifiers) {
			out.push({ sourceKind: src.kind, sourceName, mod });
		}
		// Count-scaled effects carry a representative `mod` (key/label, value = per-unit rate)
		// so partitioning and colouring still work; `scaling` drives the "per X (max Y)" text.
		for (const s of src.scaling ?? []) {
			out.push({
				sourceKind: src.kind,
				sourceName,
				mod: { key: s.key, value: s.rate, label: s.label, positiveIsGood: s.positiveIsGood },
				scaling: s
			});
		}
	}
	return out;
}

// Empire-wide effects (ethics → civics → origin), in a stable order so each
// source's modifiers stay grouped together. Species traits are handled separately.
export function collectEffects(
	draft: EffectDraft,
	index: Record<string, ModifierSource>,
	names: Record<string, string>
): EffectEntry[] {
	return rowsFor(
		[
			...draft.ethics,
			...(draft.authority ? [draft.authority] : []),
			...draft.civics,
			...(draft.origin ? [draft.origin] : [])
		],
		index,
		names
	);
}

// Per-species trait effects. Takes a list of species (an empire can have more than
// one — e.g. Syncretic Evolution); each becomes its own group labelled with the
// species name. Species with no numeric trait effects are dropped.
export interface SpeciesEffectGroup {
	species: string;
	entries: EffectEntry[];
}

export function collectSpeciesEffects(
	species: { name: string; traits: string[] }[],
	index: Record<string, ModifierSource>,
	names: Record<string, string>
): SpeciesEffectGroup[] {
	const out: SpeciesEffectGroup[] = [];
	for (const sp of species) {
		const entries = rowsFor(sp.traits, index, names);
		if (entries.length) out.push({ species: sp.name, entries });
	}
	return out;
}

// ── Grouping ──────────────────────────────────────────────────────────────────
// Empire-wide effects fall into a handful of themes, derived from the modifier key.

export interface EffectGroup {
	label: string;
	entries: EffectEntry[];
}

// Classification rules, evaluated in order — first match wins. Research is checked
// before Military so exploration/archaeology ship modifiers (anomaly, survey, …)
// don't get swept into Military by the leading `ship_`.
const GROUP_RULES: { label: string; test: RegExp }[] = [
	{
		label: 'Research & technology',
		test: /research_speed|tech_research|draw_chance|num_tech_alternatives|first_contact_speed|specimens?_|anomaly|astral_rift|archaeological|excavation|_clues_|survey/
	},
	{
		label: 'Military & fleets',
		test: /^ships?_|^owned_ship_|^army_|^space_fauna_|^attached_space_fauna_|^defensive_stations_|^storm_ship_|naval_cap|command_limit|orbital_bombardment|disengage|_vs_(psionic|superior)_empires_|military_speed|ftl_jumpdrive|jumpdrive_cooldown|hyperlane_range|weapon_|_hull_|_armor_/
	},
	{
		label: 'Jobs & resource output',
		test: /workforce_mult$|_jobs_|^planet_jobs_|^planet_[a-z]+_[a-z_]*produces_(add|mult)$|^station_[a-z_]+produces/
	},
	{
		label: 'Pops',
		test: /^pop_|^planet_pops_|^citizen_pop_|habitability|refugee_attraction|environment_tolerance|growth_mult$|_happiness(_|$)|amenities|housing_usage|attraction_mult|ethic_attraction|resettlement/
	},
	{
		label: 'Planets & construction',
		test: /^planet_|district|^habitat_|building|starbase|megastructure|terraform|stations?_cost|_limit_add$|structures_|blocker|ascension|crime|stability/
	},
	{
		label: 'Empire & diplomacy',
		test: /^country_|empire_size|envoy|diplo|edict|influence|leader|councilor|commander|official|ruler_skill|_skill_add$|_initial_skill$|intel|espionage|spy_network|operation|loyalty|subject|war_exhaustion|trust|faction|tradition_cost|election|unity_produces|government_civic/
	}
];

// Display order of the groups (only non-empty ones are shown).
const GROUP_DISPLAY_ORDER = [
	'Empire & diplomacy',
	'Pops',
	'Jobs & resource output',
	'Planets & construction',
	'Research & technology',
	'Military & fleets',
	'Other'
];

export function effectGroupOf(e: EffectEntry): string {
	for (const r of GROUP_RULES) if (r.test.test(e.mod.key)) return r.label;
	return 'Other';
}

// Bucket the flat effect list into themed groups, preserving in-group order and
// emitting groups in GROUP_DISPLAY_ORDER (skipping empties).
export function groupEffects(effects: EffectEntry[]): EffectGroup[] {
	const byLabel = new Map<string, EffectEntry[]>();
	for (const e of effects) {
		const label = effectGroupOf(e);
		if (!byLabel.has(label)) byLabel.set(label, []);
		byLabel.get(label)!.push(e);
	}
	return GROUP_DISPLAY_ORDER.filter((l) => byLabel.has(l)).map((label) => ({
		label,
		entries: byLabel.get(label)!
	}));
}
