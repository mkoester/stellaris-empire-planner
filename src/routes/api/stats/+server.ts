import { error, json } from '@sveltejs/kit';
import { stats } from '#lib/server/analytics.ts';

// The aggregates for stats-board, in its native format. Caddy guards /api/stats* with
// basic_auth (DEPLOY.md); the app itself does not authenticate.
export function GET() {
	const doc = stats();
	if (!doc) error(503, 'analytics is off (ANALYTICS_DB is not set)');
	return json(doc, { headers: { 'cache-control': 'no-store' } });
}
