import { CONSENT_COOKIE, parseConsent, routeIds } from '#lib/analytics.ts';
import { record } from '#lib/server/analytics.ts';

// The page-view beacon (`afterNavigate` in +layout.svelte): the body is the route id, never the
// URL, whose query string carries the empire. Only route ids that exist are counted, so the
// counter table cannot be filled with arbitrary strings. Always 204: a beacon reads no answer.
const ROUTES = routeIds(Object.keys(import.meta.glob('/src/routes/**/+page.svelte')));

export async function POST({ request, cookies }) {
	const route = (await request.text()).trim();
	if (ROUTES.has(route)) {
		const consent = parseConsent(cookies.get(CONSENT_COOKIE));
		record(route, typeof consent === 'object' ? consent.vid : undefined);
	}
	return new Response(null, { status: 204 });
}
