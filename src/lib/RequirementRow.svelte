<script lang="ts">
	// A card's "needs …" / "excl. …" chips (see civicRequirementLines). Exclusions start
	// shown or hidden per the shared setting; the ban icon flips them for this card only.
	// Clicks never reach the card it sits on.
	import { requirementChipClass, type CivicRequirementLine } from '$lib/civics';
	import { settings } from '$lib/settings.svelte';
	import BanIcon from '$lib/BanIcon.svelte';
	import Tip from '$lib/Tip.svelte';

	let { lines }: { lines: CivicRequirementLine[] } = $props();
	const needs = $derived(lines.filter((r) => r.type === 'require'));
	const excls = $derived(lines.filter((r) => r.type === 'exclude'));
	let override = $state<boolean | null>(null);
	const show = $derived(override ?? settings.showExclusions);
	const flip = (e: Event) => {
		e.stopPropagation();
		override = !show;
	};
</script>

{#if needs.length || excls.length}
	<div class="flex items-start gap-1">
		<div class="flex grow flex-wrap items-center gap-1">
			{#each needs as r, i (i)}
				<span class="rounded px-1.5 py-0.5 text-[10px] {requirementChipClass(r)}"
					>needs {r.text}</span
				>
			{/each}
			{#if show}
				{#each excls as r, i (i)}
					<span class="rounded px-1.5 py-0.5 text-[10px] {requirementChipClass(r)}"
						>excl. {r.text}</span
					>
				{/each}
			{/if}
		</div>
		{#if excls.length}
			<Tip text={show ? 'Hide exclusions' : 'Show exclusions'}>
				{#snippet trigger(a)}
					<span
						{...a}
						role="button"
						tabindex="0"
						aria-pressed={show}
						aria-label="{show ? 'Hide' : 'Show'} exclusions"
						onclick={flip}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								flip(e);
							}
						}}
						class="inline-flex shrink-0 cursor-pointer items-center rounded px-0.5 py-0.5 transition-colors {show
							? 'text-red-400'
							: 'text-red-400/40 hover:text-red-400/70'}"
					>
						<BanIcon />
					</span>
				{/snippet}
			</Tip>
		{/if}
	</div>
{/if}
