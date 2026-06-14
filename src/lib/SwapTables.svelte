<script lang="ts">
	// Hover trigger → a portal'd Skeleton tooltip with one diff table per swap.
	// Each table: rows = original / replacement, columns = the input/output stats that change.
	// Default trigger is the orange "Replaces" badge; pass `children` to use custom trigger
	// content (e.g. wrap a card's description text) — both surface the same tables.
	import { Tooltip } from '@skeletonlabs/skeleton-svelte';
	import type { JobSwap } from '$lib/server/db';
	import type { Snippet } from 'svelte';
	import { swapTable } from '$lib/jobs';

	let {
		swaps,
		children,
		triggerClass,
		placement = 'bottom-end'
	}: {
		swaps: JobSwap[];
		children?: Snippet;
		triggerClass?: string;
		placement?: 'bottom-end' | 'top-start' | 'top-end' | 'bottom-start';
	} = $props();
	const tables = $derived(swaps.map(swapTable));
</script>

<Tooltip openDelay={150} closeDelay={200} interactive positioning={{ placement }}>
	<Tooltip.Trigger element={trigger} />
	<Tooltip.Positioner>
		<Tooltip.Content
			class="border-surface-400-500/30 z-50 max-h-[80vh] max-w-[92vw] space-y-3 overflow-auto rounded-lg border bg-surface-50-950 p-2.5 text-xs shadow-xl"
		>
			{#each tables as t, i (i)}
				{#if t.columns.length}
					<table class="border-collapse">
						<thead>
							<tr class="opacity-55">
								<th class="px-2 py-0.5 text-left font-medium"></th>
								{#each t.columns as c (c.label)}
									<th class="px-2 py-0.5 text-right font-medium whitespace-nowrap">{c.label}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							<tr class="border-surface-400-500/20 border-t">
								<td class="px-2 py-0.5 font-medium whitespace-nowrap">{t.baseName}</td>
								{#each t.columns as c (c.label)}
									<td class="px-2 py-0.5 text-right font-mono {c.base.cls}">{c.base.text}</td>
								{/each}
							</tr>
							<tr>
								<td class="px-2 py-0.5 font-medium whitespace-nowrap">{t.swappedName}</td>
								{#each t.columns as c (c.label)}
									<td class="px-2 py-0.5 text-right font-mono {c.swapped.cls}">{c.swapped.text}</td>
								{/each}
							</tr>
						</tbody>
					</table>
				{:else}
					<div class="flex items-baseline gap-2">
						<span class="font-medium">{t.baseName} → {t.swappedName}</span>
						<span class="opacity-50">no input/output changes</span>
					</div>
				{/if}
			{/each}
		</Tooltip.Content>
	</Tooltip.Positioner>
</Tooltip>

{#snippet trigger(attrs: Record<string, unknown>)}
	{#if children}
		<div {...attrs} class={triggerClass}>{@render children()}</div>
	{:else}
		<span
			{...attrs}
			class="cursor-help rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-200"
			>Replaces</span
		>
	{/if}
{/snippet}
