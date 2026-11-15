import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			// Allow intentionally-unused bindings prefixed with `_` (e.g. `{#each ... as _, i}`)
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
			],
			// We use native Map/Set as local temporaries in $derived.by and reassign whole
			// collections into $state (immutable-update pattern), which is fully reactive in
			// Svelte 5. SvelteMap/SvelteSet would only add deep-reactivity overhead here.
			'svelte/prefer-svelte-reactivity': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// The two rules that need type information, on everything under src/: a promise nobody
		// awaits or catches, and a switch over a union that misses a member and has no default
		// (a new member then falls through silently — see startCapital.ts's effect dispatch).
		files: ['src/**/*.ts', 'src/**/*.svelte'],
		languageOptions: { parserOptions: { projectService: true } },
		rules: {
			'@typescript-eslint/no-floating-promises': 'error',
			// an explicit `default:` is an explicit last branch (planets.ts's climate chip)
			'@typescript-eslint/switch-exhaustiveness-check': [
				'error',
				{ considerDefaultExhaustiveForUnions: true }
			]
		}
	}
);
