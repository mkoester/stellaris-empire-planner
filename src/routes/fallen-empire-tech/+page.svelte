<script lang="ts">
	import type { PageData } from './$types';
	import type { FallenEmpireTech } from '$lib/server/db';
	import Tip from '$lib/Tip.svelte';

	let { data }: { data: PageData } = $props();

	const AREA_COLOR: Record<string, string> = {
		physics:     'text-sky-400',
		society:     'text-emerald-400',
		engineering: 'text-amber-400'
	};

	const AREA_BADGE: Record<string, string> = {
		physics:     'bg-sky-500/15 text-sky-300',
		society:     'bg-emerald-500/15 text-emerald-300',
		engineering: 'bg-amber-500/15 text-amber-300'
	};

	const RESOURCE_COLOR: Record<string, string> = {
		produces: 'bg-emerald-500/15 text-emerald-300/90',
		upkeep:   'bg-red-500/15 text-red-300/90',
		cost:     'bg-surface-500/20 opacity-80'
	};

	const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	const num = (n: number) => (Number.isInteger(n) ? n : parseFloat(n.toFixed(2)));

	// Group: physics dark-matter component techs first (no building_key), then
	// all FE building techs grouped by area → category.
	const byArea = $derived.by(() => {
		const areaMap = new Map<
			string,
			{
				label: string;
				categories: Map<string, { label: string; techs: FallenEmpireTech[] }>;
			}
		>();
		for (const t of data.techs as FallenEmpireTech[]) {
			if (!areaMap.has(t.area)) {
				areaMap.set(t.area, { label: t.areaLabel ?? t.area, categories: new Map() });
			}
			const area = areaMap.get(t.area)!;
			const catKey = t.category ?? '__none__';
			if (!area.categories.has(catKey)) {
				area.categories.set(catKey, {
					label: t.categoryLabel ?? t.category ?? '—',
					techs: []
				});
			}
			area.categories.get(catKey)!.techs.push(t);
		}
		return [...areaMap.entries()].map(([areaKey, { label, categories }]) => ({
			key: areaKey,
			label,
			categories: [...categories.entries()].map(([catKey, cat]) => ({
				key: catKey,
				label: cat.label,
				techs: cat.techs
			}))
		}));
	});
</script>

<main class="mx-auto max-w-5xl space-y-8 p-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Fallen Empire Technologies</h1>
		<p class="text-sm opacity-60">
			Technologies obtainable from fallen empires or via the
			<span class="font-medium">Enigmatic Engineering</span> /
			<span class="font-medium">Cosmogenesis</span> ascension perks. Building techs unlock the
			listed building on the planet where the tech is researched.
		</p>
	</div>

	{#each byArea as area (area.key)}
		<section class="space-y-5">
			<h2 class="text-xl font-bold {AREA_COLOR[area.key] ?? ''}">{area.label}</h2>

			{#each area.categories as cat (cat.key)}
				<div class="space-y-3">
					<h3 class="border-surface-400-500/20 border-b pb-1 text-sm font-semibold uppercase tracking-wider opacity-60">
						{cat.label}
					</h3>

					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each cat.techs as tech (tech.key)}
							<div class="border-surface-400-500/30 flex flex-col gap-2 rounded-lg border p-3">
								<div class="flex items-start justify-between gap-2">
									<h4 class="font-semibold leading-tight">{tech.label ?? tech.key}</h4>
									<span class="shrink-0 rounded px-1.5 py-0.5 text-[11px] {AREA_BADGE[tech.area] ?? 'bg-surface-500/20'}">
										{tech.areaLabel ?? tech.area}
									</span>
								</div>

								{#if tech.building}
									{@const b = tech.building}

									{#if b.resources.length}
										<div class="flex flex-wrap gap-1">
											{#each b.resources as r (r.kind + r.resource)}
												<Tip
													text={r.kind}
													class="rounded px-1.5 py-0.5 text-[11px] {RESOURCE_COLOR[r.kind] ?? 'bg-surface-500/20'}"
												>
													{r.kind === 'produces' ? '+' : r.kind === 'upkeep' ? '−' : ''}{num(r.amount)}
													{titleCase(r.resource)}
												</Tip>
											{/each}
										</div>
									{/if}

									{#if b.jobs.length}
										<div class="flex flex-wrap gap-1">
											{#each b.jobs as j (j.job)}
												<span class="rounded bg-sky-500/15 px-1.5 py-0.5 text-[11px] text-sky-300/90">
													{titleCase(j.job)} ×{num(j.amount / 100)}
												</span>
											{/each}
										</div>
									{/if}

									{#if b.description}
										<p class="mt-auto text-xs opacity-50 leading-relaxed">{b.description}</p>
									{/if}
								{:else}
									{#if tech.description}
										<p class="text-xs opacity-60 leading-relaxed">{tech.description}</p>
									{/if}
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</section>
	{/each}
</main>
