<script lang="ts">
	// "Jump to" anchor links for a long page's sections (and optional sub-items).
	let { links }: { links: { id: string; label: string; strong?: boolean }[] } = $props();
</script>

{#if links.length > 1}
	<nav class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-label="Jump to">
		<span class="opacity-60">Jump to:</span>
		{#each links as l (l.id)}
			<a
				href="#{l.id}"
				class="rounded px-1.5 py-0.5 hover:bg-surface-500/20 {l.strong
					? 'font-semibold text-primary-400'
					: 'opacity-70 hover:opacity-100'}">{l.label}</a
			>
		{/each}
	</nav>
{/if}
