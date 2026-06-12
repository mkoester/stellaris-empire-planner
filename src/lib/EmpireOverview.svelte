<script lang="ts">
	// Compact, always-visible summary of the current empire draft — rendered as a
	// floating panel beside the builder pages so the running choices stay in view.
	import { empire } from '$lib/empire.svelte';
	import { keyName, shipTypeLabel } from '$lib/empireFile';

	let { names }: { names: Record<string, string> } = $props();

	const draft = $derived(empire.draft);
	const has = $derived(empire.anySet());
	const name = (key: string | null) => keyName(key, names);

	const rows = $derived([
		{ label: 'Species', value: draft.speciesClass ? name(draft.speciesClass) : null },
		{ label: 'Origin', value: draft.origin ? name(draft.origin) : null },
		{ label: 'Homeworld', value: draft.planetClass ? name(draft.planetClass) : null },
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

		{#snippet group(label: string, keys: string[])}
			{#if keys.length}
				<div>
					<div class="text-[10px] uppercase opacity-40">{label}</div>
					<div class="flex flex-wrap gap-x-2 gap-y-0.5">
						{#each keys as k (k)}<span>{name(k)}</span>{/each}
					</div>
				</div>
			{/if}
		{/snippet}

		{@render group('Ethics', draft.ethics)}
		{@render group('Civics', draft.civics)}
		{@render group('Traits', draft.traits)}
	</aside>
{/if}
