<script lang="ts">
	// A federation type's name linking to its card on /federations, with the hover summary
	// (federationTip). Shared by tradition/perk effects and the civic and ethic cards. The
	// click doesn't bubble, so a link inside a selectable card doesn't also toggle the card.
	import { resolve } from '$app/paths';
	import Tip from '$lib/Tip.svelte';

	let { key, name, tip }: { key: string; name: string; tip: string } = $props();
</script>

<Tip text={tip}>
	{#snippet trigger(a)}
		<a
			{...a}
			href="{resolve('/federations')}#{key}"
			onclick={(e) => {
				(a.onclick as ((e: MouseEvent) => void) | undefined)?.(e);
				e.stopPropagation();
			}}
			class="text-emerald-300 underline decoration-dotted underline-offset-2 hover:decoration-solid"
			>{name}</a
		>
	{/snippet}
</Tip>
