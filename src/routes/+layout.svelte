<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import EmpireOverview from '$lib/EmpireOverview.svelte';
	import { settings } from '$lib/settings.svelte';

	let { children, data } = $props();

	// Global navigation — every section reachable from every page (order matters).
	const NAV = [
		{ href: '/empire', label: 'Empire' },
		{ href: '/', label: 'Species Builder' },
		{ href: '/ethics', label: 'Ethics' },
		{ href: '/government', label: 'Government' },
		{ href: '/civics', label: 'Civics' },
		{ href: '/origins', label: 'Origins' },
		{ href: '/planets', label: 'Planets' },
		{ href: '/ships', label: 'Ships' },
		{ href: '/names', label: 'Names' },
		{ href: '/precursors', label: 'Precursors' }
	] as const;
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav
	class="border-surface-400-500/30 sticky top-0 z-40 border-b bg-surface-50-950/80 backdrop-blur"
>
	<div class="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 py-2">
		{#each NAV as item (item.href)}
			<a
				href={resolve(item.href)}
				aria-current={page.url.pathname === item.href ? 'page' : undefined}
				class="rounded px-3 py-1.5 text-sm transition-colors {page.url.pathname === item.href
					? 'preset-filled-primary-500'
					: 'opacity-60 hover:bg-surface-500/20 hover:opacity-100'}"
			>
				{item.label}
			</a>
		{/each}
		<button
			onclick={() => settings.toggleRuleLayout()}
			class="ml-auto rounded px-2 py-1 text-[11px] opacity-60 hover:bg-surface-500/20 hover:opacity-100"
			title="Toggle how multi-rule effect descriptions are laid out"
		>
			Rules: {settings.ruleLayout === 'inline' ? 'inline ·|·' : 'one per line'}
		</button>
		{#if data?.gameVersion}
			<span class="text-[11px] opacity-40" title={data.gameVersion.version}>
				Stellaris {data.gameVersion.raw ?? data.gameVersion.version}
			</span>
		{/if}
	</div>
</nav>

{@render children()}

<!-- Floating running summary of the current empire (hidden on /empire, which shows its own). -->
{#if page.url.pathname !== '/empire'}
	<EmpireOverview names={data?.names ?? {}} />
{/if}
