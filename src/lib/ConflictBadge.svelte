<script lang="ts">
	// Warn-only marker for a builder option that clashes with the rest of the empire
	// (see $lib/compat). Renders nothing when there's no conflict; the reasons are in the
	// tooltip, one per line. The option itself stays clickable.
	import Tip from '$lib/Tip.svelte';
	let { reasons, class: cls = '' }: { reasons: string[]; class?: string } = $props();
</script>

{#if reasons.length}
	<Tip
		text={reasons.join('\n')}
		class="inline-flex shrink-0 items-center gap-0.5 rounded bg-red-500/20 px-1 py-0.5 text-[10px] leading-tight font-medium text-red-300 {cls}"
		>⚠ Conflict</Tip
	>
{/if}
