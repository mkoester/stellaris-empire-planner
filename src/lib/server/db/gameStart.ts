// The game's capital setup scripts (planner: starting capital) and the names they show.
import type { Effect } from '$lib/startCapital';
import { db } from './client';

// Setup script name → its effect list (see $lib/startCapital).
export function loadGameStartScripts(): Record<string, Effect[]> {
	const rows = db().prepare(`SELECT key, effects_json FROM game_start_script`).all() as Array<{
		key: string;
		effects_json: string;
	}>;
	return Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.effects_json) as Effect[]]));
}

// Key → display name for buildings, districts and zones.
export function loadCapitalNames(): Record<string, string> {
	const out: Record<string, string> = {};
	for (const table of ['building', 'district', 'zone'])
		for (const r of db()
			.prepare(`SELECT key, name FROM ${table} WHERE name IS NOT NULL`)
			.all() as Array<{ key: string; name: string }>)
			out[r.key] = r.name;
	return out;
}
