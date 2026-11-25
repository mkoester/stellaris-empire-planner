// The analytics DB: a separate, writable SQLite file at ANALYTICS_DB (never the read-only game
// DB). Unset means analytics is off: every function here is then a no-op or returns null.
//
// Two tables that never meet: page_views holds counters per day and route with no visitor id,
// visitor_days holds consenting visitors per day with no route. No path through the site can
// be rebuilt from them (docs/analytics.md).
import Database from 'better-sqlite3';
import { ANALYTICS_DB } from '$app/env/private';
import {
	RETENTION_DAYS,
	STATS_DAYS,
	TOP_ROUTES_DAYS,
	dayOf,
	daysBefore,
	statsDoc
} from '#lib/analytics.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS page_views (
	day TEXT NOT NULL, route TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, route)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS visitor_days (
	day TEXT NOT NULL, vid TEXT NOT NULL,
	PRIMARY KEY (day, vid)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS visitor_days_vid ON visitor_days (vid, day);
`;

let _db: Database.Database | null | undefined;
let prunedOn = '';

function db(): Database.Database | null {
	if (_db === undefined) {
		if (!ANALYTICS_DB) _db = null;
		else {
			_db = new Database(ANALYTICS_DB);
			_db.pragma('journal_mode = WAL');
			_db.exec(SCHEMA);
		}
	}
	return _db;
}

/** Delete visitor days past the retention, at most once a day. */
function prune(today: string) {
	const d = db();
	if (!d || prunedOn === today) return;
	d.prepare('DELETE FROM visitor_days WHERE day < ?').run(daysBefore(today, RETENTION_DAYS));
	prunedOn = today;
}

export function record(route: string, vid: string | undefined, now = Date.now()) {
	const d = db();
	if (!d) return;
	const day = dayOf(now);
	d.prepare(
		'INSERT INTO page_views (day, route, count) VALUES (?, ?, 1) ON CONFLICT DO UPDATE SET count = count + 1'
	).run(day, route);
	if (vid) d.prepare('INSERT OR IGNORE INTO visitor_days (day, vid) VALUES (?, ?)').run(day, vid);
	prune(day);
}

type DayCount = { day: string; count: number };

export function stats(now = Date.now()) {
	const d = db();
	if (!d) return null;
	const today = dayOf(now);
	const from = daysBefore(today, STATS_DAYS);
	const views = d
		.prepare(
			'SELECT day, SUM(count) AS count FROM page_views WHERE day >= ? GROUP BY day ORDER BY day'
		)
		.all(from) as DayCount[];
	const visitors = d
		.prepare(
			'SELECT day, COUNT(*) AS count FROM visitor_days WHERE day >= ? GROUP BY day ORDER BY day'
		)
		.all(from) as DayCount[];
	// A returning visitor on a day: one whose id was already seen on an earlier day.
	const returning = d
		.prepare(
			`SELECT v.day AS day, COUNT(*) AS count FROM visitor_days v
			 WHERE v.day >= ? AND EXISTS (SELECT 1 FROM visitor_days w WHERE w.vid = v.vid AND w.day < v.day)
			 GROUP BY v.day ORDER BY v.day`
		)
		.all(from) as DayCount[];
	const top = d
		.prepare(
			'SELECT route, SUM(count) AS views FROM page_views WHERE day >= ? GROUP BY route ORDER BY views DESC, route'
		)
		.all(daysBefore(today, TOP_ROUTES_DAYS)) as { route: string; views: number }[];
	return statsDoc(today, views, visitors, returning, top);
}

/** Consent withdrawn: delete every day stored for this visitor id. */
export function forget(vid: string) {
	db()?.prepare('DELETE FROM visitor_days WHERE vid = ?').run(vid);
}
