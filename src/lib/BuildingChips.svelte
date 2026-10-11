<script lang="ts">
	// "Unlocks" row for a civic / origin card: one chip per building it unlocks, each
	// opening a popup with the building's numbers. Long lists (Wilderness) fold after a few.
	import type { ReferenceBuilding } from '$lib/server/db';
	import BuildingDetails from '$lib/BuildingDetails.svelte';
	import InfoPopup from '$lib/InfoPopup.svelte';

	let { buildings }: { buildings: ReferenceBuilding[] } = $props();
	const FOLD = 4;
	let open = $state(false);
	const shown = $derived(open ? buildings : buildings.slice(0, FOLD));
</script>

{#if buildings.length}
	<div class="flex flex-wrap items-center gap-1 text-[10px]">
		<span class="opacity-45">Unlocks</span>
		{#each shown as b (b.key)}
			<InfoPopup class="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200/90">
				{b.name ?? b.key}
				{#snippet content()}
					<div class="text-sm font-semibold">{b.name ?? b.key}</div>
					<BuildingDetails building={b} />
				{/snippet}
			</InfoPopup>
		{/each}
		{#if buildings.length > FOLD}
			<button
				type="button"
				class="rounded px-1 opacity-50 hover:opacity-90"
				onclick={(e) => {
					e.stopPropagation();
					open = !open;
				}}>{open ? 'less' : `+${buildings.length - FOLD} more`}</button
			>
		{/if}
	</div>
{/if}
