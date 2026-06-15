<script lang="ts">
	// Compact, always-visible summary of the current empire draft — rendered as a
	// floating panel beside the builder pages so the running choices stay in view.
	import { empire } from '$lib/empire.svelte';
	import { keyName, shipTypeLabel } from '$lib/empireFile';
	import type { OriginStart } from '$lib/server/db';
	import LockIcon from '$lib/LockIcon.svelte';
	import Tip from '$lib/Tip.svelte';

	let {
		names,
		lockedCivics = [],
		originStarts = {},
		traitCosts = {},
		baseTraitByClass = {},
		tooltips = {}
	}: {
		names: Record<string, string>;
		lockedCivics?: string[];
		originStarts?: Record<string, OriginStart>;
		traitCosts?: Record<string, number>;
		baseTraitByClass?: Record<string, string>;
		tooltips?: Record<string, string>;
	} = $props();
	const tip = (key: string | null) => (key ? (tooltips[key] ?? '') : '');
	const locked = $derived(new Set(lockedCivics));

	// Trait colour: amber for the species' auto-included base trait (matching the builder),
	// red for negative-cost (drawback) traits, default otherwise.
	const traitColor = (k: string, base: string | undefined) =>
		k === base ? 'text-amber-400' : (traitCosts[k] ?? 0) < 0 ? 'text-red-400' : '';

	const draft = $derived(empire.draft);
	const has = $derived(empire.anySet());
	const name = (key: string | null) => keyName(key, names);

	// Alphabetical by display name; traits additionally push negative-cost (drawback) traits last.
	const byName = (keys: string[]) => [...keys].sort((a, b) => name(a).localeCompare(name(b)));
	const sortTraits = (keys: string[]) =>
		[...keys].sort(
			(a, b) =>
				Number((traitCosts[a] ?? 0) < 0) - Number((traitCosts[b] ?? 0) < 0) ||
				name(a).localeCompare(name(b))
		);

	// An origin can force the starting world (Shattered Ring → Ring Segment, …) and/or a
	// fixed home system; both then override the Planets / Home-system picks.
	const originStart = $derived(draft.origin ? (originStarts[draft.origin] ?? null) : null);
	const forcedWorld = $derived(originStart?.world ?? null);
	const forcesSystem = $derived(originStart?.forcesSystem ?? false);

	const rows = $derived<{ label: string; value: string | null; tipKey: string | null }[]>([
		{ label: 'Species', value: draft.speciesClass ? name(draft.speciesClass) : null, tipKey: null },
		{
			label: 'Secondary species',
			value: draft.secondary
				? draft.secondary.speciesName ||
					(draft.secondary.speciesClass ? name(draft.secondary.speciesClass) : 'Secondary species')
				: null,
			tipKey: null
		},
		{
			label: 'Government',
			value: draft.authority ? name(draft.authority) : null,
			tipKey: draft.authority
		},
		{ label: 'Origin', value: draft.origin ? name(draft.origin) : null, tipKey: draft.origin },
		{
			label: 'Homeworld',
			value: forcedWorld
				? `${name(forcedWorld)} (origin)`
				: draft.planetClass
					? name(draft.planetClass)
					: null,
			tipKey: null
		},
		{
			label: 'Home system',
			value: forcesSystem ? 'set by origin' : draft.initializer ? name(draft.initializer) : null,
			tipKey: null
		},
		{
			label: 'Ship type',
			value: draft.graphicalCulture ? shipTypeLabel(draft.graphicalCulture) : null,
			tipKey: null
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
						<dd><Tip text={tip(r.tipKey)}>{r.value}</Tip></dd>
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
							<Tip text={tip(k)} class="inline-flex items-center gap-0.5"
								>{name(k)}{#if lockSet?.has(k)}<LockIcon size={10} />{/if}</Tip
							>
						{/each}
					</div>
				</div>
			{/if}
		{/snippet}

		<!-- Traits: prepend the species' auto-included base trait; colour base/negatives. -->
		{#snippet traitGroup(label: string, classKey: string | null, traitKeys: string[])}
			{@const base = classKey ? baseTraitByClass[classKey] : undefined}
			{@const rest = sortTraits(base ? traitKeys.filter((k) => k !== base) : traitKeys)}
			{@const all = base ? [base, ...rest] : rest}
			{#if all.length}
				<div>
					<div class="text-[10px] uppercase opacity-40">{label}</div>
					<div class="flex flex-wrap gap-x-2 gap-y-0.5">
						{#each all as k (k)}
							<Tip text={tip(k)} class={traitColor(k, base)}>{name(k)}</Tip>
						{/each}
					</div>
				</div>
			{/if}
		{/snippet}

		{@render group('Ethics', draft.ethics)}
		{@render group('Civics', byName(draft.civics), locked)}
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
