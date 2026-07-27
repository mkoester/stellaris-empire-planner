// Shared read-only SQLite handle and DB meta (game version).
import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';

let _db: Database.Database | null = null;

export function db(): Database.Database {
	if (!_db) {
		// Read at runtime (not build time) so the same image works wherever the DB is
		// mounted/bundled. In dev this comes from .env; the container sets it explicitly.
		const path = env.STELLARIS_DB;
		if (!path) throw new Error('STELLARIS_DB is not set');
		_db = new Database(path, { readonly: true, fileMustExist: true });
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
