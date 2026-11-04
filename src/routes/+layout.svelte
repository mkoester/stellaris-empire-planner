<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import BackToTop from '$lib/BackToTop.svelte';
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
		{ href: '/room', label: 'Room' },
		{ href: '/help', label: 'Help me choose' }
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
		<a
			href="https://discord.gg/7pcbj5abfE"
			target="_blank"
			rel="noopener"
			class="opacity-40 hover:opacity-100"
			title="Bugs & feedback: the empire-planner forum on Discord"
			aria-label="Discord"
			><svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor" aria-hidden="true"
				><path
					d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"
				/></svg
			></a
		>
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

<!-- Back to the top of any page once it has been scrolled down (hidden on short pages). -->
<BackToTop />

<footer class="px-4 py-3 text-center text-[11px] opacity-40">
	Unofficial fan project, not affiliated with Paradox Interactive. Stellaris and all game data and
	text © Paradox Interactive AB. ·
	<a href="https://github.com/mkoester/stellaris-empire-planner" class="underline"
		>Source (AGPL-3.0)</a
	>
	·
	<a href="https://discord.gg/7pcbj5abfE" class="underline">Bugs &amp; feedback (Discord)</a>
</footer>

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
