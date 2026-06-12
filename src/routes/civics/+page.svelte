<script lang="ts">
	import type { PageData } from './$types';
	import type { Civic } from '$lib/server/db';
	import { dlcBadge } from '$lib/precursors';
	import {
		groupCivicsByType,
		formatModifierValue,
		modifierColor,
		modifierLabel,
		civicRequirementLines
	} from '$lib/civics';
	import { empire } from '$lib/empire.svelte';

	let { data }: { data: PageData } = $props();
	const civics = $derived(data.civics as Civic[]);

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
	<h1 class="text-2xl font-bold">Civics</h1>

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
					<button
						type="button"
						aria-pressed={selected}
						onclick={() => empire.toggleCivic(civic.key)}
						class="space-y-2 rounded-lg border p-3 text-left transition-colors {selected
							? 'border-primary-500 bg-primary-500/10'
							: 'border-surface-400-500/30 hover:border-surface-400-500/60'}"
					>
						<header class="flex flex-wrap items-baseline gap-2">
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
									<span
										class="rounded px-1.5 py-0.5 text-[10px] {r.type === 'require'
											? 'bg-emerald-500/12 text-emerald-300/90'
											: 'bg-red-500/12 text-red-300/90'}"
										>{r.type === 'require' ? 'needs' : 'excl.'} {r.text}</span
									>
								{/each}
							</div>
						{/if}

						<!-- Numeric modifiers -->
						{#if civic.modifiers.length}
							<ul class="space-y-0.5 text-xs">
								{#each civic.modifiers as mod (mod.key)}
									<li class="flex items-baseline justify-between gap-3">
										<span class="opacity-70">{modifierLabel(mod)}</span>
										<span class="shrink-0 font-mono {modifierColor(mod)}"
											>{formatModifierValue(mod)}</span
										>
									</li>
								{/each}
							</ul>
						{/if}

						<!-- Effects description -->
						{#if civic.description}
							<p class="text-xs opacity-55">{civic.description}</p>
						{/if}
					</button>
				{/each}
			</div>
		</section>
	{/each}
</main>
