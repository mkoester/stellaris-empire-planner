import { loadPrescriptedEmpires, loadEntityNames } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	predefined: loadPrescriptedEmpires(),
	names: loadEntityNames()
});
