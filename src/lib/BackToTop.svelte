<script lang="ts">
	// Floating "back to top" button for long reference pages; appears after scrolling down.
	// On xl it sits left of the fixed EmpireOverview panel (top-right, w-52).
	let y = $state(0);
</script>

<svelte:window bind:scrollY={y} />

{#if y > 600}
	<button
		class="fixed right-4 bottom-4 z-40 rounded-full preset-filled-primary-500 px-3 py-2 text-sm shadow-lg xl:right-60"
		aria-label="Back to top"
		onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
	>
		↑ Top
	</button>
{/if}
