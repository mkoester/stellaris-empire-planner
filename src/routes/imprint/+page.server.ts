import { operator } from '#lib/server/operator.ts';
import type { PageServerLoad } from './$types';

// Name and address only (§ 18(1) MStV); the email is on the privacy page.
export const load: PageServerLoad = () => {
	const o = operator();
	return { operator: o && { name: o.name, address: o.address } };
};
