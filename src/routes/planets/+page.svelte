<script lang="ts">
	import type { PageData } from './$types';
	import type { PlanetClass } from '$lib/server/db';
	import { groupPlanetClasses, climateBadge } from '$lib/planets';
	import { empire } from '$lib/empire.svelte';
	import Tip from '$lib/Tip.svelte';
	import { compatChecker } from '$lib/compat';

	let { data }: { data: PageData } = $props();
	const groups = $derived(groupPlanetClasses(data.planetClasses as PlanetClass[]));
	const initializers = $derived(data.initializers);
	const draft = $derived(empire.draft);
	// Debug: render selectable cards as plain elements so their text can be copied.
	const debug = $derived(data.debugDisableSelection);
	// Cross-section conflicts (warn only — see $lib/compat): civic/origin/trait homeworld gates.
	const compat = $derived(compatChecker(empire.draft, data));
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<h1 class="text-2xl font-bold">Planets</h1>

	<p class="max-w-3xl text-sm opacity-60">
		The world types your empire can settle. A species has full habitability on its
		<strong>preferred climate</strong>, reduced on others in the same family (wet / dry / cold), and
		least on a different family — so the climate group, not the individual world, drives
		habitability.
	</p>

	<!-- Home system (starting solar-system initializer) -->
	<section class="border-surface-400-500/30 space-y-2 rounded-lg border p-4">
		<div>
			<h2 class="text-lg font-semibold">Home system</h2>
			<p class="text-xs opacity-50">
				The starting system. Most empires leave this random; a few origins need a specific one.
			</p>
		</div>
		<label class="flex max-w-xs flex-col gap-1 text-sm">
			<span class="opacity-60">Starting system</span>
			<select
				class="select"
				value={draft.initializer}
				onchange={(e) => empire.setInitializer(e.currentTarget.value)}
			>
				<option value="">Default (random)</option>
				{#each initializers as init (init.key)}
					<option value={init.key}>{init.name || init.key}</option>
				{/each}
			</select>
		</label>
	</section>

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
					{@const warn = pc.colonizable ? compat.reasons('planet_class', pc.key) : []}
					{#if pc.colonizable}
						<Tip
							text={debug
								? undefined
								: [...warn.map((r) => `⚠ ${r}`), 'Set as homeworld'].join('\n')}
						>
							{#snippet trigger(a)}
								<svelte:element
									this={debug ? 'div' : 'button'}
									{...a}
									type={debug ? undefined : 'button'}
									aria-pressed={debug ? undefined : selected}
									onclick={debug
										? undefined
										: () => empire.setPlanetClass(selected ? null : pc.key)}
									class="flex items-center gap-1.5 rounded border px-2 py-1 text-sm transition-colors {selected
										? 'border-primary-500 bg-primary-500/10'
										: 'border-surface-400-500/30 hover:border-surface-400-500/60'} {warn.length
										? 'ring-2 ring-red-500/70 ring-inset'
										: ''} {debug ? 'cursor-text select-text' : ''}"
								>
									{pc.name ?? pc.key}
									{#if pc.climate}
										<span class="rounded px-1 text-[10px] {climateBadge(pc.climate)}"
											>{pc.climate}</span
										>
									{/if}
									{#if pc.isStandard}
										<Tip text="A default startable climate" class="text-[10px] opacity-40"
											>start</Tip
										>
									{/if}
								</svelte:element>
							{/snippet}
						</Tip>
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
