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
			GROUP_CONCAT(DISTINCT tt.tag) AS tags
		FROM trait t
		LEFT JOIN trait_archetype ta ON t.key = ta.trait_key
		LEFT JOIN trait_opposite to2 ON t.key = to2.trait_key
		LEFT JOIN trait_tag tt ON t.key = tt.trait_key
		WHERE t.initial = 1 AND t.hidden = 0 AND t.category IS NOT NULL
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
	}>;

	return rows.map((r) => ({
		key: r.key,
		cost: r.cost,
		category: r.category,
		initial: r.initial,
		hidden: r.hidden,
		required_dlc: r.required_dlc,
		archetypes: r.archetypes ? r.archetypes.split(',') : [],
		opposites: r.opposites ? r.opposites.split(',') : [],
		tags: r.tags ? r.tags.split(',') : []
	}));
}
