<script lang="ts">
	// The capital the planned empire starts with: districts, zones and buildings, from the
	// game's own setup scripts (see $lib/startCapital).
	import { picksFromDraft } from '$lib/compat';
	import type { EmpireDraft } from '$lib/empire.svelte';
	import { prettyKey } from '$lib/civics';
	import { leafText, profileFromDraft } from '$lib/triggers';
	import { capitalOf, fromText, partsText, type CapitalData } from '$lib/startCapital';

	let {
		draft,
		data,
		names
	}: {
		draft: EmpireDraft;
		data: CapitalData;
		names: Record<string, string>; // entity names plus buildings, districts and zones
	} = $props();

	const name = (k: string) => names[k] ?? prettyKey(k);
	const from = (rs: Parameters<typeof fromText>[0]) => fromText(rs, names);
	const ready = $derived(draft.authority !== null && draft.origin !== null);
	const picks = $derived(picksFromDraft(draft, data.baseTraitByClass, data.originStarts));
	const nomadic = $derived(
		profileFromDraft(draft, data.archetypeOf, data.nomadicOrigins).flags.includes('nomadic')
	);
	const capital = $derived(capitalOf(draft, data));
	// Buildings by the zone they went into; the rest stand on their own.
	const inZone = (zone: string) => capital.buildings.filter((b) => b.zone === zone);
	const unzoned = $derived(
		capital.buildings.filter((b) => !b.zone || !capital.zones.some((z) => z.zone === b.zone))
	);
	const missing = $derived(
		[
			!draft.speciesClass && 'species class',
			!picks.homeworld && !nomadic && 'homeworld',
			picks.shipType === null && 'ship set'
		].filter((x): x is string => !!x)
	);
</script>

<section class="border-surface-400-500/30 space-y-4 rounded-lg border p-4">
	<h2 class="text-xl font-semibold">Starting Capital</h2>
	{#if !ready}
		<p class="text-sm opacity-50">Pick a government and an origin to see the starting capital.</p>
	{:else}
		{#snippet row(label: string, source: string, cls = '')}
			<li class="flex items-baseline gap-3 {cls}">
				<span class="flex-1">{label}</span>
				<span class="shrink-0 text-right text-xs opacity-50">{source}</span>
			</li>
		{/snippet}

		<div class="space-y-1">
			<h3 class="text-xs font-semibold tracking-wide uppercase opacity-50">Districts</h3>
			<ul class="space-y-0.5 text-sm">
				{#each capital.districts as d (d.district)}
					{@render row(`${name(d.district)} ×${d.count}`, partsText(d.parts, names))}
				{/each}
			</ul>
		</div>

		{#if capital.zones.length}
			<div class="space-y-1">
				<h3 class="text-xs font-semibold tracking-wide uppercase opacity-50">
					Zones <span class="font-normal opacity-60">· with their buildings</span>
				</h3>
				<ul class="space-y-0.5 text-sm">
					{#each capital.zones as z, i (i)}
						{@render row(
							`${name(z.zone)} (in ${name(z.district)})`,
							from(z.reasons),
							'font-medium'
						)}
						{#each inZone(z.zone) as b, j (j)}
							{@render row(`${name(b.building)}`, from(b.reasons), 'pl-4 text-emerald-300/90')}
						{/each}
					{/each}
				</ul>
			</div>
		{/if}

		{#if unzoned.length}
			<div class="space-y-1">
				<h3 class="text-xs font-semibold tracking-wide uppercase opacity-50">Buildings</h3>
				<ul class="space-y-0.5 text-sm">
					{#each unzoned as b, i (i)}
						{@render row(name(b.building), from(b.reasons), 'text-emerald-300/90')}
					{/each}
				</ul>
			</div>
		{/if}

		{#if missing.length || capital.unknownChecks.length || capital.unknownEffects.length}
			<div class="space-y-0.5 text-xs text-amber-300/80">
				{#if missing.length}
					<p>Not picked yet, so counted as absent: {missing.join(', ')}.</p>
				{/if}
				{#if capital.unknownChecks.length}
					<p>
						Undecided, counted as not met:
						{capital.unknownChecks.map((t) => leafText(t, names)).join(', ')}.
					</p>
				{/if}
				{#if capital.unknownEffects.length}
					<p>Not modelled: {capital.unknownEffects.map(prettyKey).join(', ')}.</p>
				{/if}
			</div>
		{/if}
		<p class="text-xs opacity-45">
			From the game's start-of-game scripts. Planet size and blockers can still cap rural districts.
		</p>
	{/if}
</section>
