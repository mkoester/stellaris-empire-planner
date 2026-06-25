<script lang="ts">
	import type { PageData } from './$types';
	import type { RepeatableTech } from '$lib/server/db';
	import { formatModifierValue, modifierLabel, modifierColor } from '$lib/civics';

	let { data }: { data: PageData } = $props();

	// Group by area → category, preserving DB sort order within each group.
	const byArea = $derived.by(() => {
		const areaMap = new Map<string, { label: string; categories: Map<string, { label: string; techs: RepeatableTech[] }> }>();
		for (const t of data.techs as RepeatableTech[]) {
			if (!areaMap.has(t.area)) {
				areaMap.set(t.area, { label: t.areaLabel ?? t.area, categories: new Map() });
			}
			const area = areaMap.get(t.area)!;
			const catKey = t.category ?? '__none__';
			if (!area.categories.has(catKey)) {
				area.categories.set(catKey, { label: t.categoryLabel ?? t.category ?? '—', techs: [] });
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
</script>

<main class="mx-auto max-w-5xl space-y-8 p-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Repeatable Technologies</h1>
		<p class="text-sm opacity-60">
			Technologies that can be researched multiple times, each level applying the same effect again.
			Unlimited (∞) techs scale indefinitely; capped techs list their maximum level.
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
									<span class="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-mono {AREA_BADGE[tech.area] ?? 'bg-surface-500/20'}">
										{tech.levels === -1 ? '∞' : `×${tech.levels}`}
									</span>
								</div>

								{#if tech.modifiers.length}
									<ul class="space-y-0.5 text-xs">
										{#each tech.modifiers as mod (mod.key)}
											<li class="flex items-baseline gap-1.5">
												<span class="font-mono font-semibold {modifierColor(mod)}">
													{formatModifierValue(mod)}
												</span>
												<span class="opacity-75">{modifierLabel(mod)}</span>
											</li>
										{/each}
									</ul>
								{/if}

								{#if tech.description}
									<p class="mt-auto text-xs opacity-50 leading-relaxed">{tech.description}</p>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</section>
	{/each}
</main>
