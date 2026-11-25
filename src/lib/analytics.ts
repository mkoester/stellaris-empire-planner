// Page statistics and consented returning-visitor counts (docs/analytics.md). Pure: shared by
// the banner, the beacon endpoint and the stats endpoint.

export const CONSENT_COOKIE = 'consent';
/** 13 months, the longest lifetime German and French regulators accept for a consent cookie. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 396;
/** Visitor-day rows older than the cookie's lifetime are deleted. */
export const RETENTION_DAYS = 396;
/** How far back /api/stats reports. */
export const STATS_DAYS = 90;
export const TOP_ROUTES_DAYS = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The cookie's value -> a visitor id after "OK", 'no' after "No thanks", undefined if unanswered. */
export function parseConsent(value: string | undefined): { vid: string } | 'no' | undefined {
	if (value === 'no') return 'no';
	return value && UUID.test(value) ? { vid: value } : undefined;
}

/** `document.cookie` -> the consent cookie's value. */
export function consentFrom(cookies: string): string | undefined {
	for (const part of cookies.split(';')) {
		const [k, ...v] = part.trim().split('=');
		if (k === CONSENT_COOKIE) return v.join('=');
	}
	return undefined;
}

/** A Set-Cookie-style string for `document.cookie`. `maxAge` 0 deletes it. */
export function consentCookie(value: string, secure: boolean, maxAge = CONSENT_MAX_AGE): string {
	return `${CONSENT_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** The UTC day of a timestamp, `YYYY-MM-DD`. */
export function dayOf(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

export function daysBefore(day: string, n: number): string {
	return dayOf(Date.parse(`${day}T00:00:00Z`) - n * 86_400_000);
}

/** SvelteKit route files (`import.meta.glob` keys) -> route ids: `/src/routes/civics/+page.svelte` -> `/civics`. */
export function routeIds(files: string[]): Set<string> {
	return new Set(
		files.map((f) => f.replace(/^\/src\/routes/, '').replace(/\/\+page\.svelte$/, '') || '/')
	);
}

type DayCount = { day: string; count: number };

/** -> stats-board's native format (workspace_homelab/stats-board/docs/design.md). */
export function statsDoc(
	today: string,
	views: DayCount[],
	visitors: DayCount[],
	returning: DayCount[],
	top: { route: string; views: number }[]
) {
	const points = (rows: DayCount[]) => rows.map((r) => ({ t: r.day, v: r.count }));
	return {
		version: 1,
		updated: today,
		data: [
			{ kind: 'series', id: 'views-per-day', title: 'Page views per day', points: points(views) },
			{
				kind: 'series',
				id: 'visitors-per-day',
				title: 'Visitors per day (with consent)',
				points: points(visitors)
			},
			{
				kind: 'series',
				id: 'returning-per-day',
				title: 'Returning visitors per day (with consent)',
				points: points(returning)
			},
			{
				kind: 'table',
				id: 'top-routes',
				title: `Top pages, last ${TOP_ROUTES_DAYS} days`,
				columns: [
					{ key: 'route', title: 'Page' },
					{ key: 'views', title: 'Views' }
				],
				rows: top
			}
		]
	};
}

/** The operator's details from the env (imprint, privacy policy), or null if any is missing. */
export function operatorFrom(
	name: string | undefined,
	address: string | undefined,
	email: string | undefined
): { name: string; address: string[]; email: string } | null {
	const lines = (address ?? '')
		.split(';')
		.map((l) => l.trim())
		.filter(Boolean);
	if (!name?.trim() || !lines.length || !email?.trim()) return null;
	return { name: name.trim(), address: lines, email: email.trim() };
}
