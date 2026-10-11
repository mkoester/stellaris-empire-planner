<script lang="ts">
	import type { PageData } from './$types';
	import type { Civic, JobSwap } from '$lib/server/db';
	import { dlcBadge } from '$lib/precursors';
	import {
		groupCivicsByType,
		formatModifierValue,
		modifierColor,
		modifierLabel,
		sortModifiers,
		civicRequirementLines,
		requirementChipClass
	} from '$lib/civics';
	import SwapTables from '$lib/SwapTables.svelte';
	import FederationAccess from '$lib/FederationAccess.svelte';
	import Tip from '$lib/Tip.svelte';
	import BanIcon from '$lib/BanIcon.svelte';
	import RuleText from '$lib/RuleText.svelte';
	import RequirementLegend from '$lib/RequirementLegend.svelte';
	import LockIcon from '$lib/LockIcon.svelte';
	import ConflictBadge from '$lib/ConflictBadge.svelte';
	import AscensionChips from '$lib/AscensionChips.svelte';
	import { compatChecker } from '$lib/compat';
	import { conflictClass } from '$lib/conflict';
	import { empire } from '$lib/empire.svelte';
	import { settings } from '$lib/settings.svelte';

	let { data }: { data: PageData } = $props();
	// Cross-section conflicts (warn only — see $lib/compat).
	const compat = $derived(compatChecker(empire.draft, data));
	const civics = $derived(data.civics as Civic[]);
	const jobSwaps = $derived((data.jobSwaps ?? {}) as Record<string, JobSwap[]>);
	// Debug: render selectable cards as plain elements so their text can be copied.
	const debug = $derived(data.debugDisableSelection);

	// Free-text filter across name + description.
	let query = $state('');

	// Per-card override of the global "show exclusions" default, keyed by civic key.
	// A card's exclusions show when its override is set, else the global setting.
	let openExcl = $state<Record<string, boolean>>({});
	function toggleExcl(key: string) {
		openExcl = { ...openExcl, [key]: !(openExcl[key] ?? settings.showExclusions) };
	}
	const groups = $derived(
		groupCivicsByType(
			query.trim()
				? civics.filter((c) =>
						`${c.name ?? c.key} ${c.description ?? ''}`.toLowerCase().includes(query.toLowerCase())
					)
				: civics
		)
	);
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<h1 class="text-2xl font-bold">Civics</h1>
		<RequirementLegend />
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<input class="input max-w-sm" type="search" placeholder="Filter civics…" bind:value={query} />
		<button
			class="rounded px-2 py-1 text-[11px] opacity-60 hover:bg-surface-500/20 hover:opacity-100"
			onclick={() => settings.toggleExclusions()}
		>
			{settings.showExclusions ? 'Hide exclusions' : 'Show exclusions'}
		</button>
	</div>

	{#each groups as group (group.type)}
		<section class="space-y-3">
			<h2 class="text-lg font-semibold">
				{group.label}
				<span class="text-sm font-normal opacity-40">· {group.items.length}</span>
			</h2>

			<div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
				{#each group.items as civic (civic.key)}
					{@const reqs = civicRequirementLines(civic.requirements, data.names)}
					{@const needs = reqs.filter((r) => r.type === 'require')}
					{@const excls = reqs.filter((r) => r.type === 'exclude')}
					{@const showExcl = openExcl[civic.key] ?? settings.showExclusions}
					{@const selected = empire.draft.civics.includes(civic.key)}
					{@const conflicts = compat.reasons('civic', civic.key)}
					{@const mods = sortModifiers(civic.modifiers)}
					{@const swaps = jobSwaps[civic.key] ?? []}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<svelte:element
						this={debug ? 'div' : 'button'}
						type={debug ? undefined : 'button'}
						aria-pressed={debug ? undefined : selected}
						onclick={debug ? undefined : () => empire.toggleCivic(civic.key)}
						class="relative flex h-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors {selected
							? 'border-primary-500 bg-primary-500/10'
							: 'border-surface-400-500/30 hover:border-surface-400-500/60'} {conflictClass(
							conflicts,
							selected
						)} {debug ? 'cursor-text select-text' : ''}"
					>
						<header class="flex items-start justify-between gap-2">
							<h3 class="font-semibold">{civic.name ?? civic.key}</h3>
							<div class="flex shrink-0 items-center gap-1">
								{#if swaps.length}
									<SwapTables {swaps} />
								{/if}
								{#if civic.requiredDlc}
									<Tip
										text={civic.requiredDlc}
										class="rounded border px-1.5 py-0.5 text-[10px] font-normal {dlcBadge(
											civic.requiredDlc
										)}">DLC</Tip
									>
								{/if}
								<AscensionChips lock={civic.ascensionLock} blocks={civic.ascensionBlocks} />
								{#if civic.locked}<LockIcon />{/if}
								<ConflictBadge reasons={conflicts} />
							</div>
						</header>

						<!-- Requirements / exclusions. Toggle pinned top-right; badges wrap on the left. -->
						{#if needs.length || excls.length}
							<div class="flex items-start gap-1">
								<div class="flex grow flex-wrap items-center gap-1">
									{#each needs as r, i (i)}
										<span class="rounded px-1.5 py-0.5 text-[10px] {requirementChipClass(r)}"
											>needs {r.text}</span
										>
									{/each}
									{#if showExcl}
										{#each excls as r, i (i)}
											<span class="rounded px-1.5 py-0.5 text-[10px] {requirementChipClass(r)}"
												>excl. {r.text}</span
											>
										{/each}
									{/if}
								</div>
								{#if excls.length}
									<Tip text={showExcl ? 'Hide exclusions' : 'Show exclusions'}>
										{#snippet trigger(a)}
											<span
												{...a}
												role="button"
												tabindex="0"
												aria-pressed={showExcl}
												aria-label="{showExcl ? 'Hide' : 'Show'} exclusions"
												onclick={(e) => {
													e.stopPropagation();
													toggleExcl(civic.key);
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														e.stopPropagation();
														toggleExcl(civic.key);
													}
												}}
												class="inline-flex shrink-0 cursor-pointer items-center rounded px-0.5 py-0.5 transition-colors {showExcl
													? 'text-red-400'
													: 'text-red-400/40 hover:text-red-400/70'}"
											>
												<BanIcon />
											</span>
										{/snippet}
									</Tip>
								{/if}
							</div>
						{/if}

						<!-- Numeric modifiers: alphabetical, attunement split off below a divider.
						     Attunement only matters with Psionic Ascension, so it's dimmed. -->
						{#if mods.main.length || mods.attunement.length}
							{#snippet modRow(mod: (typeof mods.main)[number], muted: boolean)}
								<li class="flex items-baseline justify-between gap-3 {muted ? 'opacity-45' : ''}">
									<span class="opacity-70">{modifierLabel(mod)}</span>
									<span class="shrink-0 font-mono {muted ? '' : modifierColor(mod)}"
										>{formatModifierValue(mod)}</span
									>
								</li>
							{/snippet}
							{#if mods.main.length}
								<ul class="space-y-0.5 text-xs">
									{#each mods.main as mod (mod.key)}{@render modRow(mod, false)}{/each}
								</ul>
							{/if}
							{#if mods.attunement.length}
								<hr class="my-1 border-current opacity-45" />
								<ul class="space-y-0.5 text-xs">
									{#each mods.attunement as mod (mod.key)}{@render modRow(mod, true)}{/each}
								</ul>
							{/if}
						{/if}

						<FederationAccess itemKey={civic.key} types={data.federationTypes} />

						<!-- Effects description pinned to the bottom (divider above it if attunement shown).
						     When the civic replaces jobs, hovering the description also opens the swap table. -->
						{#snippet descBody()}
							{#if mods.attunement.length}<hr class="my-1 border-current opacity-45" />{/if}
							<RuleText text={civic.description!} class="text-xs opacity-55" />
						{/snippet}
						{#if civic.description}
							{#if swaps.length}
								<SwapTables {swaps} placement="top-start" triggerClass="mt-auto block cursor-help">
									{@render descBody()}
								</SwapTables>
							{:else}
								<div class="mt-auto">{@render descBody()}</div>
							{/if}
						{/if}
					</svelte:element>
				{/each}
			</div>
		</section>
	{/each}
</main>
