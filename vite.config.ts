import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { decoratedVersion } from './scripts/version.mjs';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// shown in the nav: which build this is (scripts/version.mjs)
	define: { __APP_VERSION__: JSON.stringify(decoratedVersion()) },
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
