<script lang="ts">
	// A small chip that opens a portal'd, hoverable panel with richer content than <Tip>
	// (lists, chips) — same look as SwapTables. Clicking the chip doesn't reach the card
	// it sits on, so it never toggles a builder pick.
	import { Tooltip } from '@skeletonlabs/skeleton-svelte';
	import type { Snippet } from 'svelte';

	let {
		children,
		content,
		class: cls = '',
		placement = 'bottom-start'
	}: {
		children: Snippet;
		content: Snippet;
		class?: string;
		placement?: 'bottom-end' | 'top-start' | 'top-end' | 'bottom-start';
	} = $props();
</script>

<Tooltip openDelay={150} closeDelay={200} interactive positioning={{ placement }}>
	<Tooltip.Trigger element={trigger} />
	<Tooltip.Positioner>
		<Tooltip.Content
			class="border-surface-400-500/30 z-50 max-h-[80vh] w-80 max-w-[92vw] space-y-2 overflow-auto rounded-lg border bg-surface-50-950 p-2.5 text-xs shadow-xl"
		>
			{@render content()}
		</Tooltip.Content>
	</Tooltip.Positioner>
</Tooltip>

{#snippet trigger(attrs: Record<string, unknown>)}
	<span {...attrs} class="cursor-help {cls}" onclick={(e) => e.stopPropagation()}
		>{@render children()}</span
	>
{/snippet}
