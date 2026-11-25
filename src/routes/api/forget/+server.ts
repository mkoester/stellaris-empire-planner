import { parseConsent } from '#lib/analytics.ts';
import { forget } from '#lib/server/analytics.ts';

// Withdrawing consent ("Cookie settings"): the browser sends its visitor id one last time, before
// deleting the cookie, and every day stored for it is deleted (GDPR Art. 17(1)(b)). The id is in
// the body rather than read from the cookie, because the cookie may be gone by the time the beacon
// leaves. Always 204: a beacon reads no answer.
export async function POST({ request }) {
	const consent = parseConsent((await request.text()).trim());
	if (typeof consent === 'object') forget(consent.vid);
	return new Response(null, { status: 204 });
}
