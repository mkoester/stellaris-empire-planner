// Environment variables, read when the server starts (https://svelte.dev/docs/kit/environment-variables).
// All optional here: a build runs without them, and db() names a missing STELLARIS_DB itself.
import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	STELLARIS_DB: {
		description: 'Path to the SQLite DB built by stellaris-data-extraction.',
		schema: optional
	},
	APP_VERSION: {
		description: 'Version shown in the nav, set by the container build; wins over __APP_VERSION__.',
		schema: optional
	},
	DEBUG_DISABLE_SELECTION: {
		description: 'Any non-empty value renders the builder cards as plain, selectable text.',
		schema: optional
	}
});
