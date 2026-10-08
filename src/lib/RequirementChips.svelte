<script lang="ts">
	// Requirement lines of a trigger as chips, coloured by whether the profile meets them:
	// emerald = met, red = not met, neutral = unknown (the profile can't tell).
	import type { RequirementLine } from '$lib/triggers';

	let { lines, label = '' }: { lines: RequirementLine[]; label?: string } = $props();

	// Long exclusion lists (ascension trees name every other path) fold after a few.
	const FOLD = 4;
	let open = $state(false);
	const shown = $derived(open ? lines : lines.slice(0, FOLD));

	const tone = (l: RequirementLine) =>
		l.state === true
			? 'border-emerald-500/40 text-emerald-300'
			: l.state === false
				? 'border-red-500/50 text-red-300'
				: 'border-surface-400-500/40 opacity-80';
</script>

{#if lines.length}
	<div class="flex flex-wrap items-center gap-1 text-[11px]">
		{#if label}<span class="opacity-50">{label}</span>{/if}
		{#each shown as l, i (i)}
			<span class="rounded border px-1.5 py-0.5 {tone(l)}">
				{#if l.type === 'excludes'}<span class="opacity-60">no </span>{/if}{l.text}
			</span>
		{/each}
		{#if lines.length > FOLD}
			<button class="opacity-50 hover:opacity-100" onclick={() => (open = !open)}>
				{open ? 'less' : `+${lines.length - FOLD} more`}
			</button>
		{/if}
	</div>
{/if}
