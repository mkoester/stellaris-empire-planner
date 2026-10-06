// Empire-setup assets: planet classes, prescripted empires, initializers, rooms, flags.
import { db } from './client';

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

// ── Empires (predefined + the shared empire shape) ───────────────────────────

// A full empire design — the shape shared by the predefined empires and a parsed
// user_empire_designs.txt entry. Values are raw keys; resolve names via
// loadEntityNames() (or key-formatting for traits/authorities).
export interface Empire {
	key: string;
	name: string;
	// Player-facing names. Resolved to display text for predefined empires; literal for
	// user files. Optional so a parsed file that omits them just leaves them blank.
	adjective?: string | null;
	shipPrefix?: string | null;
	speciesName?: string | null;
	speciesPlural?: string | null;
	speciesAdjective?: string | null;
	rulerName?: string | null;
	planetName?: string | null;
	systemName?: string | null;
	speciesClass: string | null;
	speciesPortrait: string | null;
	// Second founding species (Syncretic Evolution / Necrophage / …); null parts = none.
	secondaryClass?: string | null;
	secondaryPortrait?: string | null;
	secondaryName?: string | null;
	secondaryPlural?: string | null;
	secondaryAdjective?: string | null;
	secondaryTraits?: string[];
	authority: string | null;
	government: string | null;
	origin: string | null;
	planetClass: string | null;
	initializer?: string | null; // home-system initializer (custom_empire start)
	room?: string | null; // diplomacy room backdrop
	flag?: EmpireFlag | null; // empire flag (populated when parsed from a file)
	graphicalCulture: string | null; // ship appearance
	ethics: string[];
	civics: string[];
	traits: string[];
	source: 'predefined' | 'file';
}

// An empire flag: an icon + background (each a category/file pair, .dds assets) over up
// to four named colours ("null" marks an unused colour slot).
export interface EmpireFlag {
	iconCategory: string | null;
	iconFile: string | null;
	backgroundCategory: string | null;
	backgroundFile: string | null;
	colors: string[];
}

// Home-system initializers usable as a custom-empire start (for the picker).
export function loadInitializers(): { key: string; name: string | null }[] {
	return db().prepare('SELECT key, name FROM initializer ORDER BY sort_order').all() as {
		key: string;
		name: string | null;
	}[];
}

// Diplomacy rooms (the ruler backdrop) an empire can pick.
export function loadRooms(): { key: string; label: string | null }[] {
	return db().prepare('SELECT key, label FROM room ORDER BY sort_order').all() as {
		key: string;
		label: string | null;
	}[];
}

// ── Jobs (reference) ───────────────────────────────────────────────────────────

// Flag assets for the flag editor: icon categories + files, and the background files.
export function loadFlagAssets(): {
	categories: string[];
	iconsByCategory: Record<string, string[]>;
	backgrounds: string[];
} {
	const rows = db()
		.prepare('SELECT kind, category, file FROM flag_asset ORDER BY category, sort_order')
		.all() as { kind: string; category: string; file: string }[];
	const iconsByCategory: Record<string, string[]> = {};
	const backgrounds: string[] = [];
	for (const r of rows) {
		if (r.kind === 'background') backgrounds.push(r.file);
		else (iconsByCategory[r.category] ??= []).push(r.file);
	}
	return { categories: Object.keys(iconsByCategory), iconsByCategory, backgrounds };
}

// The empire-flag colour palette (named colours) with a CSS hex for swatches.
export function loadFlagColors(): { key: string; hex: string }[] {
	const rows = db()
		.prepare(
			`SELECT key, r, g, b FROM named_color WHERE source_file = '00_basic_colors.txt' ORDER BY key`
		)
		.all() as { key: string; r: number; g: number; b: number }[];
	const h = (n: number) => n.toString(16).padStart(2, '0');
	return rows.map((c) => ({ key: c.key, hex: `#${h(c.r)}${h(c.g)}${h(c.b)}` }));
}

export function loadPrescriptedEmpires(): Empire[] {
	const d = db();
	const rows = d
		.prepare(
			`SELECT key, name, adjective, ship_prefix, species_class, species_portrait,
			        species_name, species_plural, species_adjective,
			        secondary_class, secondary_portrait, secondary_name,
			        secondary_plural, secondary_adjective, ruler_name,
			        planet_name, system_name, authority, government,
			        origin, planet_class, initializer, graphical_culture
			 FROM prescripted_empire WHERE selectable = 1 ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string;
		adjective: string | null;
		ship_prefix: string | null;
		species_class: string | null;
		species_portrait: string | null;
		species_name: string | null;
		species_plural: string | null;
		species_adjective: string | null;
		secondary_class: string | null;
		secondary_portrait: string | null;
		secondary_name: string | null;
		secondary_plural: string | null;
		secondary_adjective: string | null;
		ruler_name: string | null;
		planet_name: string | null;
		system_name: string | null;
		authority: string | null;
		government: string | null;
		origin: string | null;
		planet_class: string | null;
		initializer: string | null;
		graphical_culture: string | null;
	}>;
	const itemRows = d
		.prepare(
			`SELECT empire_key, kind, value FROM prescripted_empire_item
			 ORDER BY empire_key, sort_order`
		)
		.all() as Array<{ empire_key: string; kind: string; value: string }>;
	const items = new Map<
		string,
		{ traits: string[]; secondaryTraits: string[]; civics: string[]; ethics: string[] }
	>();
	for (const r of itemRows) {
		if (!items.has(r.empire_key))
			items.set(r.empire_key, { traits: [], secondaryTraits: [], civics: [], ethics: [] });
		const e = items.get(r.empire_key)!;
		if (r.kind === 'trait') e.traits.push(r.value);
		else if (r.kind === 'secondary_trait') e.secondaryTraits.push(r.value);
		else if (r.kind === 'civic') e.civics.push(r.value);
		else if (r.kind === 'ethic') e.ethics.push(r.value);
	}
	return rows.map((r) => ({
		key: r.key,
		name: r.name,
		adjective: r.adjective,
		shipPrefix: r.ship_prefix,
		speciesName: r.species_name,
		speciesPlural: r.species_plural,
		speciesAdjective: r.species_adjective,
		secondaryClass: r.secondary_class,
		secondaryPortrait: r.secondary_portrait,
		secondaryName: r.secondary_name,
		secondaryPlural: r.secondary_plural,
		secondaryAdjective: r.secondary_adjective,
		secondaryTraits: items.get(r.key)?.secondaryTraits ?? [],
		rulerName: r.ruler_name,
		planetName: r.planet_name,
		systemName: r.system_name,
		speciesClass: r.species_class,
		speciesPortrait: r.species_portrait,
		authority: r.authority,
		government: r.government,
		origin: r.origin,
		planetClass: r.planet_class,
		initializer: r.initializer,
		graphicalCulture: r.graphical_culture,
		ethics: items.get(r.key)?.ethics ?? [],
		civics: items.get(r.key)?.civics ?? [],
		traits: items.get(r.key)?.traits ?? [],
		source: 'predefined' as const
	}));
}
