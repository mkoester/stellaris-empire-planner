<script lang="ts">
	import type { PageData } from './$types';
	import type { PlanetClass } from '$lib/server/db';
	import { groupPlanetClasses, climateBadge } from '$lib/planets';
	import { empire } from '$lib/empire.svelte';

	let { data }: { data: PageData } = $props();
	const groups = $derived(groupPlanetClasses(data.planetClasses as PlanetClass[]));
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<h1 class="text-2xl font-bold">Planets</h1>

	<p class="max-w-3xl text-sm opacity-60">
		The world types your empire can settle. A species has full habitability on its
		<strong>preferred climate</strong>, reduced on others in the same family (wet / dry / cold), and
		least on a different family — so the climate group, not the individual world, drives
		habitability.
	</p>

	{#each groups as group (group.label)}
		<section class="space-y-2">
			<h2 class="text-lg font-semibold">
				{group.label}
				<span class="text-sm font-normal opacity-40">· {group.items.length}</span>
			</h2>
			{#if group.note}<p class="text-xs opacity-45">{group.note}</p>{/if}

			<div class="flex flex-wrap gap-2">
				{#each group.items as pc (pc.key)}
					{@const selected = empire.draft.planetClass === pc.key}
					{#if pc.colonizable}
						<button
							type="button"
							aria-pressed={selected}
							title="Set as homeworld"
							onclick={() => empire.setPlanetClass(selected ? null : pc.key)}
							class="flex items-center gap-1.5 rounded border px-2 py-1 text-sm transition-colors {selected
								? 'border-primary-500 bg-primary-500/10'
								: 'border-surface-400-500/30 hover:border-surface-400-500/60'}"
						>
							{pc.name ?? pc.key}
							{#if pc.climate}
								<span class="rounded px-1 text-[10px] {climateBadge(pc.climate)}">{pc.climate}</span
								>
							{/if}
							{#if pc.isStandard}
								<span class="text-[10px] opacity-40" title="A default startable climate">start</span
								>
							{/if}
						</button>
					{:else}
						<span
							class="border-surface-400-500/30 flex items-center gap-1.5 rounded border px-2 py-1 text-sm opacity-55"
						>
							{pc.name ?? pc.key}
						</span>
					{/if}
				{/each}
			</div>
		</section>
	{/each}
</main>
