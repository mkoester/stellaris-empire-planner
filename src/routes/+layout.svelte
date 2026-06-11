<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data?.gameVersion}
	<div
		class="pointer-events-none fixed top-2 right-3 z-50 text-[11px] opacity-40"
		title={data.gameVersion.version}
	>
		Stellaris {data.gameVersion.raw ?? data.gameVersion.version}
	</div>
{/if}

{@render children()}
