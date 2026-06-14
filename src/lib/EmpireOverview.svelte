<script lang="ts">
	// Compact, always-visible summary of the current empire draft — rendered as a
	// floating panel beside the builder pages so the running choices stay in view.
	import { empire } from '$lib/empire.svelte';
	import { keyName, shipTypeLabel } from '$lib/empireFile';
	import type { OriginStart } from '$lib/server/db';
	import LockIcon from '$lib/LockIcon.svelte';

	let {
		names,
		lockedCivics = [],
		originStarts = {},
		traitCosts = {},
		baseTraitByClass = {}
	}: {
		names: Record<string, string>;
		lockedCivics?: string[];
		originStarts?: Record<string, OriginStart>;
		traitCosts?: Record<string, number>;
		baseTraitByClass?: Record<string, string>;
	} = $props();
	const locked = $derived(new Set(lockedCivics));

	// Trait colour: amber for the species' auto-included base trait (matching the builder),
	// red for negative-cost (drawback) traits, default otherwise.
	const traitColor = (k: string, base: string | undefined) =>
		k === base ? 'text-amber-400' : (traitCosts[k] ?? 0) < 0 ? 'text-red-400' : '';

	const draft = $derived(empire.draft);
	const has = $derived(empire.anySet());
	const name = (key: string | null) => keyName(key, names);

	// An origin can force the starting world (Shattered Ring → Ring Segment, …) and/or a
	// fixed home system; both then override the Planets / Home-system picks.
	const originStart = $derived(draft.origin ? (originStarts[draft.origin] ?? null) : null);
	const forcedWorld = $derived(originStart?.world ?? null);
	const forcesSystem = $derived(originStart?.forcesSystem ?? false);

	const rows = $derived([
		{ label: 'Species', value: draft.speciesClass ? name(draft.speciesClass) : null },
		{
			label: 'Secondary species',
			value: draft.secondary
				? draft.secondary.speciesName ||
					(draft.secondary.speciesClass ? name(draft.secondary.speciesClass) : 'Secondary species')
				: null
		},
		{ label: 'Government', value: draft.authority ? name(draft.authority) : null },
		{ label: 'Origin', value: draft.origin ? name(draft.origin) : null },
		{
			label: 'Homeworld',
			value: forcedWorld
				? `${name(forcedWorld)} (origin)`
				: draft.planetClass
					? name(draft.planetClass)
					: null
		},
		{
			label: 'Home system',
			value: forcesSystem ? 'set by origin' : draft.initializer ? name(draft.initializer) : null
		},
		{
			label: 'Ship type',
			value: draft.graphicalCulture ? shipTypeLabel(draft.graphicalCulture) : null
		}
	]);
</script>

{#if has}
	<aside
		class="border-surface-400-500/30 fixed top-20 right-3 z-30 hidden max-h-[calc(100vh-6rem)] w-52 space-y-3 overflow-y-auto rounded-lg border bg-surface-50-950/80 p-3 text-sm shadow-lg backdrop-blur xl:block"
	>
		<div class="font-semibold">{draft.name || 'Current empire'}</div>

		<dl class="space-y-1">
			{#each rows as r (r.label)}
				{#if r.value}
					<div>
						<dt class="text-[10px] uppercase opacity-40">{r.label}</dt>
						<dd>{r.value}</dd>
					</div>
				{/if}
			{/each}
		</dl>

		{#snippet group(label: string, keys: string[], lockSet?: Set<string>)}
			{#if keys.length}
				<div>
					<div class="text-[10px] uppercase opacity-40">{label}</div>
					<div class="flex flex-wrap gap-x-2 gap-y-0.5">
						{#each keys as k (k)}
							<span class="inline-flex items-center gap-0.5"
								>{name(k)}{#if lockSet?.has(k)}<LockIcon size={10} />{/if}</span
							>
						{/each}
					</div>
				</div>
			{/if}
		{/snippet}

		<!-- Traits: prepend the species' auto-included base trait; colour base/negatives. -->
		{#snippet traitGroup(label: string, classKey: string | null, traitKeys: string[])}
			{@const base = classKey ? baseTraitByClass[classKey] : undefined}
			{@const all = base && !traitKeys.includes(base) ? [base, ...traitKeys] : traitKeys}
			{#if all.length}
				<div>
					<div class="text-[10px] uppercase opacity-40">{label}</div>
					<div class="flex flex-wrap gap-x-2 gap-y-0.5">
						{#each all as k (k)}
							<span class={traitColor(k, base)}>{name(k)}</span>
						{/each}
					</div>
				</div>
			{/if}
		{/snippet}

		{@render group('Ethics', draft.ethics)}
		{@render group('Civics', draft.civics, locked)}
		{@render traitGroup('Traits', draft.speciesClass, draft.traits)}
		{#if draft.secondary}
			{@render traitGroup(
				'2nd species traits',
				draft.secondary.speciesClass,
				draft.secondary.traits
			)}
		{/if}
	</aside>
{/if}
