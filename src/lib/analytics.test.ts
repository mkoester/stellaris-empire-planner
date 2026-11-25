import { describe, it, expect } from 'vitest';
import {
	consentCookie,
	consentFrom,
	dayOf,
	daysBefore,
	parseConsent,
	routeIds,
	operatorFrom,
	statsDoc
} from '#lib/analytics.ts';

describe('consent cookie', () => {
	const vid = '0b9a6c1e-5f3d-4e2a-9c7b-1d2e3f4a5b6c';

	it('tells an answer from no answer', () => {
		expect(parseConsent(vid)).toEqual({ vid });
		expect(parseConsent('no')).toBe('no');
		expect(parseConsent(undefined)).toBeUndefined();
		expect(parseConsent('')).toBeUndefined();
		// anything else is treated as unanswered, so a tampered value is never stored as an id
		expect(parseConsent('<script>')).toBeUndefined();
		expect(parseConsent(vid.toUpperCase())).toBeUndefined();
	});

	it('finds its value among other cookies', () => {
		expect(consentFrom(`a=1; consent=${vid}; b=2`)).toBe(vid);
		expect(consentFrom('a=1')).toBeUndefined();
		expect(consentFrom('')).toBeUndefined();
	});

	it('is written with 13 months, Lax, and Secure only on https', () => {
		expect(consentCookie('no', true)).toBe(
			'consent=no; Max-Age=34214400; Path=/; SameSite=Lax; Secure'
		);
		expect(consentCookie('', false, 0)).toBe('consent=; Max-Age=0; Path=/; SameSite=Lax');
	});
});

describe('days', () => {
	it('buckets by UTC day', () => {
		expect(dayOf(Date.UTC(2026, 10, 25, 23, 59))).toBe('2026-11-25');
		expect(daysBefore('2026-03-01', 1)).toBe('2026-02-28');
		expect(daysBefore('2026-11-25', 30)).toBe('2026-10-26');
	});
});

describe('routeIds', () => {
	it('turns route files into the ids afterNavigate reports', () => {
		const ids = routeIds([
			'/src/routes/+page.svelte',
			'/src/routes/civics/+page.svelte',
			'/src/routes/api/tech/[key]/+page.svelte'
		]);
		expect([...ids]).toEqual(['/', '/civics', '/api/tech/[key]']);
	});
	it('covers the real routes', () => {
		const ids = routeIds(Object.keys(import.meta.glob('/src/routes/**/+page.svelte')));
		expect(ids.has('/')).toBe(true);
		expect(ids.has('/civics')).toBe(true);
	});
});

describe('statsDoc', () => {
	it('is stats-board native format', () => {
		const doc = statsDoc(
			'2026-11-25',
			[{ day: '2026-11-24', count: 7 }],
			[{ day: '2026-11-24', count: 2 }],
			[],
			[{ route: '/civics', views: 7 }]
		);
		expect(doc.version).toBe(1);
		expect(doc.data.map((d) => d.id)).toEqual([
			'views-per-day',
			'visitors-per-day',
			'returning-per-day',
			'top-routes'
		]);
		expect(doc.data[0]).toMatchObject({ kind: 'series', points: [{ t: '2026-11-24', v: 7 }] });
		expect(doc.data[3]).toMatchObject({ kind: 'table', rows: [{ route: '/civics', views: 7 }] });
	});
});

describe('operatorFrom', () => {
	it('needs name, address and email', () => {
		expect(operatorFrom('A B', 'Street 1; 12345 Town', 'a@b.de')).toEqual({
			name: 'A B',
			address: ['Street 1', '12345 Town'],
			email: 'a@b.de'
		});
		expect(operatorFrom(undefined, 'Street 1', 'a@b.de')).toBeNull();
		expect(operatorFrom('A B', ' ; ', 'a@b.de')).toBeNull();
		expect(operatorFrom('A B', 'Street 1', '')).toBeNull();
	});
});
