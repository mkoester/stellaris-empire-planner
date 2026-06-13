import {
	loadPrescriptedEmpires,
	loadEntityNames,
	loadModifierIndex,
	loadEthics,
	loadCivics,
	loadOrigins
} from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	predefined: loadPrescriptedEmpires(),
	names: loadEntityNames(),
	modifierIndex: loadModifierIndex(),
	ethics: loadEthics(),
	civics: loadCivics(),
	origins: loadOrigins()
});
