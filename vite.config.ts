import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vitest/config';
import { decoratedVersion } from './scripts/version.mjs';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// adapter-node builds a standalone Node server (`node build`), which is what we
			// run inside the container. See https://svelte.dev/docs/kit/adapter-node
			adapter: adapter()
		})
	],
	// shown in the nav: which build this is (scripts/version.mjs)
	define: { __APP_VERSION__: JSON.stringify(decoratedVersion()) },
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
