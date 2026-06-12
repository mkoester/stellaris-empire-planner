<script lang="ts">
	// Legend for the colour-coded requirement chips (one hue per gated kind). Uses the
	// stronger "excl." shade as the swatch; the lighter shade means "needs".
	import { REQUIREMENT_KINDS, requirementChipClass } from '$lib/civics';
</script>

<div class="flex flex-wrap items-center gap-1.5 text-[10px]">
	{#each REQUIREMENT_KINDS as k (k.kind)}
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
