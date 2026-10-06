<script lang="ts">
	// Simple text tooltip on a Skeleton (Zag) Tooltip — the styled, portal'd replacement for
	// native `title=`. Two modes:
	//   <Tip text="…" class="badge">DLC</Tip>           → wraps children in a styled <span> trigger
	//   <Tip text="…">{#snippet trigger(a)}<button {...a} …/>{/snippet}</Tip>
	//                                                    → caller owns the element (cards / svelte:element)
	// When `text` is empty the element renders with no tooltip (no extra wrapper behaviour).
	import { Tooltip } from '@skeletonlabs/skeleton-svelte';
	import type { Snippet } from 'svelte';

	type Placement =
		'bottom' | 'top' | 'left' | 'right' | 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

	let {
		text,
		children,
		trigger,
		class: cls = '',
		style,
		placement = 'bottom'
	}: {
		text?: string | null;
		children?: Snippet;
		trigger?: Snippet<[Record<string, unknown>]>;
		class?: string;
		style?: string;
		placement?: Placement;
	} = $props();
</script>

{#if text}
	<Tooltip openDelay={300} closeDelay={100} positioning={{ placement }}>
		<Tooltip.Trigger element={triggerEl} />
		<Tooltip.Positioner>
			<Tooltip.Content
				class="border-surface-400-500/30 z-50 max-w-xs rounded-md border bg-surface-50-950 px-2 py-1 text-xs whitespace-pre-line shadow-lg"
			>
				{text}
			</Tooltip.Content>
		</Tooltip.Positioner>
	</Tooltip>
{:else if trigger}
	{@render trigger({})}
{:else}
	<span class={cls} {style}>{@render children?.()}</span>
{/if}

{#snippet triggerEl(attrs: Record<string, unknown>)}
	{#if trigger}
		<!-- Custom element (card/button): caller keeps its own cursor (pointer/not-allowed). -->
		{@render trigger(attrs)}
	{:else}
		<!-- Info badge/text: show the "?" help cursor, the standard "hover for info" hint. -->
		<span {...attrs} class="cursor-help {cls}" {style}>{@render children?.()}</span>
	{/if}
{/snippet}
