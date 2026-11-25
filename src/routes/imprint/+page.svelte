<script lang="ts">
	import { resolve } from '$app/paths';
	// § 18(1) MStV: name and address, easy to find. The details come from the deployment's env.
	let { data } = $props();
</script>

<svelte:head><title>Imprint · Stellaris Empire Planner</title></svelte:head>

<main class="mx-auto max-w-3xl space-y-4 p-4">
	<h1 class="text-2xl font-bold">Imprint</h1>
	{#if data.operator}
		<section class="space-y-1">
			<p class="text-sm opacity-60">Information according to § 18(1) MStV</p>
			<address class="not-italic">
				{data.operator.name}<br />
				{#each data.operator.address as line, i (i)}{line}<br />{/each}
			</address>
		</section>
	{:else}
		<p class="opacity-60">The operator's details are not configured on this server.</p>
	{/if}
	<p class="text-sm opacity-60">
		A free, non-commercial fan project. Not affiliated with Paradox Interactive. See also the
		<a href={resolve('/privacy')} class="underline">privacy policy</a>.
	</p>
</main>
