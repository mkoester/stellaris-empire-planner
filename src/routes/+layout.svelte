<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import EmpireOverview from '$lib/EmpireOverview.svelte';
	import Tip from '$lib/Tip.svelte';
	import { settings } from '$lib/settings.svelte';

	let { children, data } = $props();

	// Global navigation — every section reachable from every page (order matters).
	const NAV = [
		{ href: '/', label: 'Home' },
		{ href: '/empire', label: 'Empire' },
		{ href: '/species', label: 'Species Builder' },
		{ href: '/portraits', label: 'Portraits' },
		{ href: '/ethics', label: 'Ethics' },
		{ href: '/government', label: 'Government' },
		{ href: '/civics', label: 'Civics' },
		{ href: '/origins', label: 'Origins' },
		{ href: '/planets', label: 'Planets' },
		{ href: '/ships', label: 'Ships' },
		{ href: '/names', label: 'Names' },
		{ href: '/flag', label: 'Flag' },
		{ href: '/room', label: 'Room' }
	] as const;

	// Reference game-data tables that augment the planner (not part of empire creation) —
	// grouped under an "Information" dropdown.
	const INFO = [
		{ href: '/precursors', label: 'Precursors' },
		{ href: '/traditions', label: 'Tradition Trees' },
		{ href: '/ascension-perks', label: 'Ascension Perks' },
		{ href: '/federations', label: 'Federations' },
		{ href: '/jobs', label: 'Jobs' },
		{ href: '/buildings', label: 'Buildings' },
		{ href: '/tech', label: 'Repeatable Techs' },
		{ href: '/fallen-empire-tech', label: 'Fallen Empire Techs' }
	] as const;

	let infoOpen = $state(false);
	const infoActive = $derived(INFO.some((i) => i.href === page.url.pathname));
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<svelte:window
	onclick={() => (infoOpen = false)}
	onkeydown={(e) => e.key === 'Escape' && (infoOpen = false)}
/>

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

		<!-- Information dropdown: reference tables (Precursors / Jobs / Buildings). -->
		<div class="relative">
			<button
				onclick={(e) => {
					e.stopPropagation();
					infoOpen = !infoOpen;
				}}
				aria-haspopup="menu"
				aria-expanded={infoOpen}
				class="rounded px-3 py-1.5 text-sm transition-colors {infoActive
					? 'preset-filled-primary-500'
					: 'opacity-60 hover:bg-surface-500/20 hover:opacity-100'}"
			>
				Information <span class="text-[10px] opacity-70">{infoOpen ? '▴' : '▾'}</span>
			</button>
			{#if infoOpen}
				<div
					class="border-surface-400-500/30 absolute top-full left-0 z-50 mt-1 flex min-w-36 flex-col rounded-md border bg-surface-50-950 p-1 shadow-lg"
				>
					{#each INFO as item (item.href)}
						<a
							href={resolve(item.href)}
							aria-current={page.url.pathname === item.href ? 'page' : undefined}
							class="rounded px-3 py-1.5 text-sm transition-colors {page.url.pathname === item.href
								? 'preset-filled-primary-500'
								: 'opacity-70 hover:bg-surface-500/20 hover:opacity-100'}"
						>
							{item.label}
						</a>
					{/each}
				</div>
			{/if}
		</div>

		<Tip text="Toggle how multi-rule effect descriptions are laid out" placement="bottom-end">
			{#snippet trigger(a)}
				<button
					{...a}
					onclick={() => settings.toggleRuleLayout()}
					class="ml-auto rounded px-2 py-1 text-[11px] opacity-60 hover:bg-surface-500/20 hover:opacity-100"
				>
					Rules: {settings.ruleLayout === 'inline' ? 'inline ·|·' : 'one per line'}
				</button>
			{/snippet}
		</Tip>
		{#if data?.gameVersion}
			<Tip text={data.gameVersion.version} class="text-[11px] opacity-40">
				Stellaris {data.gameVersion.raw ?? data.gameVersion.version}
			</Tip>
		{/if}
		{#if data?.appVersion}
			<span class="text-[11px] opacity-40">· v{data.appVersion}</span>
		{/if}
	</div>
</nav>

{@render children()}

<!-- Floating running summary of the current empire (hidden on /empire, which shows its
     own, and on the / landing page, which isn't part of empire creation). -->
{#if page.url.pathname !== '/empire' && page.url.pathname !== '/'}
	<EmpireOverview
		names={data?.names ?? {}}
		lockedCivics={data?.lockedCivics ?? []}
		originStarts={data?.originStarts ?? {}}
		traitCosts={data?.traitCosts ?? {}}
		baseTraitByClass={data?.baseTraitByClass ?? {}}
		tooltips={data?.overviewTooltips ?? {}}
	/>
{/if}
