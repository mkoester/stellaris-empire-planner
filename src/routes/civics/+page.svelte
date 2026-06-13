<script lang="ts">
	import type { PageData } from './$types';
	import type { Civic } from '$lib/server/db';
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
	import RuleText from '$lib/RuleText.svelte';
	import RequirementLegend from '$lib/RequirementLegend.svelte';
	import LockIcon from '$lib/LockIcon.svelte';
	import { empire } from '$lib/empire.svelte';

	let { data }: { data: PageData } = $props();
	const civics = $derived(data.civics as Civic[]);
	// Debug: render selectable cards as plain elements so their text can be copied.
	const debug = $derived(data.debugDisableSelection);

	// Free-text filter across name + description.
	let query = $state('');
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

	<input class="input max-w-sm" type="search" placeholder="Filter civics…" bind:value={query} />

	{#each groups as group (group.type)}
		<section class="space-y-3">
			<h2 class="text-lg font-semibold">
				{group.label}
				<span class="text-sm font-normal opacity-40">· {group.items.length}</span>
			</h2>

			<div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
				{#each group.items as civic (civic.key)}
					{@const reqs = civicRequirementLines(civic.requirements)}
					{@const selected = empire.draft.civics.includes(civic.key)}
					{@const mods = sortModifiers(civic.modifiers)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<svelte:element
						this={debug ? 'div' : 'button'}
						type={debug ? undefined : 'button'}
						aria-pressed={debug ? undefined : selected}
						onclick={debug ? undefined : () => empire.toggleCivic(civic.key)}
						class="relative flex h-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors {selected
							? 'border-primary-500 bg-primary-500/10'
							: 'border-surface-400-500/30 hover:border-surface-400-500/60'} {debug
							? 'cursor-text select-text'
							: ''}"
					>
						{#if civic.locked}
							<LockIcon class="absolute top-1.5 right-1.5" />
						{/if}
						<header class="flex flex-wrap items-baseline gap-2 pr-5">
							<h3 class="font-semibold">{civic.name ?? civic.key}</h3>
							{#if civic.requiredDlc}
								<span
									class="rounded border px-1.5 py-0.5 text-[10px] font-normal {dlcBadge(
										civic.requiredDlc
									)}"
									title={civic.requiredDlc}>DLC</span
								>
							{/if}
						</header>

						<!-- Requirements / exclusions -->
						{#if reqs.length}
							<div class="flex flex-wrap gap-1">
								{#each reqs as r, i (i)}
									<span class="rounded px-1.5 py-0.5 text-[10px] {requirementChipClass(r)}"
										>{r.type === 'require' ? 'needs' : 'excl.'} {r.text}</span
									>
								{/each}
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

						<!-- Effects description pinned to the bottom (divider above it if attunement shown) -->
						{#if civic.description}
							<div class="mt-auto">
								{#if mods.attunement.length}<hr class="my-1 border-current opacity-45" />{/if}
								<RuleText text={civic.description} class="text-xs opacity-55" />
							</div>
						{/if}
					</svelte:element>
				{/each}
			</div>
		</section>
	{/each}
</main>
