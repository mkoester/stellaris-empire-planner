<script lang="ts">
	// The capital the planned empire starts with: districts, zones and buildings, from the
	// game's own setup scripts (see $lib/startCapital).
	import type { Picks } from '$lib/compat';
	import type { EmpireDraft } from '$lib/empire.svelte';
	import { prettyKey } from '$lib/civics';
	import { leafText, profileFromDraft } from '$lib/triggers';
	import { simulateStartCapital, SETUP_REGULAR, SETUP_VOID, type Effect } from '$lib/startCapital';

	let {
		draft,
		picks,
		founderTraits,
		scripts,
		archetypeOf,
		nomadicOrigins,
		names
	}: {
		draft: EmpireDraft;
		picks: Picks;
		founderTraits: string[]; // picked and granted; the class's base trait is added here
		scripts: Record<string, Effect[]>;
		archetypeOf: Record<string, string | null>;
		nomadicOrigins: string[];
		names: Record<string, string>; // entity names plus buildings, districts and zones
	} = $props();

	const name = (k: string) => names[k] ?? prettyKey(k);
	const ready = $derived(draft.authority !== null && draft.origin !== null);
	const profile = $derived(profileFromDraft(draft, archetypeOf, nomadicOrigins));
	const capital = $derived.by(() => {
		const script =
			scripts[profile.flags.includes('voidDweller') ? SETUP_VOID : SETUP_REGULAR] ?? [];
		return simulateStartCapital(script, {
			profile,
			authority: draft.authority,
			traits: [...(picks.baseTrait ? [picks.baseTrait] : []), ...founderTraits],
			archetype: draft.speciesClass ? (archetypeOf[draft.speciesClass] ?? null) : null,
			planetClass: profile.flags.includes('nomadic') ? 'pc_ark' : picks.homeworld,
			bioShips: picks.shipType === null ? null : picks.shipType === 'organic'
		});
	});
	// Buildings by the zone they went into; the rest stand on their own.
	const inZone = (zone: string) => capital.buildings.filter((b) => b.zone === zone);
	const unzoned = $derived(
		capital.buildings.filter((b) => !b.zone || !capital.zones.some((z) => z.zone === b.zone))
	);
	const missing = $derived(
		[
			!draft.speciesClass && 'species class',
			!picks.homeworld && !profile.flags.includes('nomadic') && 'homeworld',
			picks.shipType === null && 'ship set'
		].filter((x): x is string => !!x)
	);
</script>

<section class="border-surface-400-500/30 space-y-4 rounded-lg border p-4">
	<h2 class="text-xl font-semibold">Starting Capital</h2>
	{#if !ready}
		<p class="text-sm opacity-50">Pick a government and an origin to see the starting capital.</p>
	{:else}
		<div class="space-y-1">
			<h3 class="text-xs font-semibold tracking-wide uppercase opacity-50">Districts</h3>
			<div class="flex flex-wrap gap-1.5">
				{#each capital.districts as d (d.district)}
					<span class="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs text-sky-300/90">
						{name(d.district)} <span class="tabular-nums opacity-70">×{d.count}</span>
					</span>
				{/each}
			</div>
		</div>

		{#if capital.zones.length}
			<div class="space-y-1">
				<h3 class="text-xs font-semibold tracking-wide uppercase opacity-50">Zones</h3>
				<ul class="space-y-1 text-sm">
					{#each capital.zones as z, i (i)}
						<li>
							<span class="font-medium">{name(z.zone)}</span>
							<span class="text-xs opacity-45">(in {name(z.district)})</span>
							{#each inZone(z.zone) as b, j (j)}
								<span
									class="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-300/90"
									>{name(b.building)}</span
								>
							{/each}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if unzoned.length}
			<div class="space-y-1">
				<h3 class="text-xs font-semibold tracking-wide uppercase opacity-50">Buildings</h3>
				<div class="flex flex-wrap gap-1.5">
					{#each unzoned as b, i (i)}
						<span class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-300/90"
							>{name(b.building)}</span
						>
					{/each}
				</div>
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
