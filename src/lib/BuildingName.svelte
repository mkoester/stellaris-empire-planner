<script lang="ts">
	// A building's name that opens its numbers (cost, jobs, what they produce worked) on
	// hover; plain text when the building's data isn't loaded.
	import type { ReferenceBuilding } from '$lib/server/db';
	import BuildingDetails from '$lib/BuildingDetails.svelte';
	import InfoPopup from '$lib/InfoPopup.svelte';

	let {
		building,
		label,
		class: cls = ''
	}: { building: ReferenceBuilding | undefined; label: string; class?: string } = $props();
</script>

{#if building}
	<InfoPopup class="underline decoration-dotted underline-offset-2 {cls}">
		{label}
		{#snippet content()}
			<div class="text-sm font-semibold">{building.name ?? building.key}</div>
			<BuildingDetails {building} />
		{/snippet}
	</InfoPopup>
{:else}
	<span class={cls}>{label}</span>
{/if}
