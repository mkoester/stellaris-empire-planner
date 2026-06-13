<script lang="ts">
	// Legend for the colour-coded requirement chips (one hue per gated kind). Uses the
	// stronger "excl." shade as the swatch; the lighter shade means "needs". Defaults to
	// the full set; a page can pass the subset of kinds it actually uses.
	import { REQUIREMENT_KINDS, requirementChipClass } from '$lib/civics';

	let { kinds = REQUIREMENT_KINDS }: { kinds?: { kind: string; label: string }[] } = $props();
</script>

<div class="flex flex-wrap items-center gap-1.5 text-[10px]">
	{#each kinds as k (k.kind)}
		<span
			class="rounded px-1.5 py-0.5 {requirementChipClass({
				kind: k.kind,
				type: 'exclude',
				text: ''
			})}">{k.label}</span
		>
	{/each}
	<span class="opacity-40">lighter = needs · stronger = excludes</span>
</div>
