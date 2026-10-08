<script lang="ts">
	// "Can form / Cannot form" federation lines for a civic or ethic card (federationsFor).
	import type { FederationType } from '$lib/server/db';
	import FederationLink from '$lib/FederationLink.svelte';
	import { federationsFor, federationTip } from '$lib/federations';

	let { itemKey, types }: { itemKey: string; types: FederationType[] } = $props();
	const access = $derived(federationsFor(itemKey, types));
</script>

{#snippet line(label: string, list: FederationType[])}
	<p class="text-xs opacity-75">
		{label}
		{#each list as f, i (f.key)}{i > 0 ? ', ' : ''}<FederationLink
				key={f.key}
				name={f.name ?? f.key}
				tip={federationTip(f)}
			/>{/each}
	</p>
{/snippet}

{#if access.forms.length}{@render line('Can form federation:', access.forms)}{/if}
{#if access.blocks.length}{@render line('Cannot form federation:', access.blocks)}{/if}
