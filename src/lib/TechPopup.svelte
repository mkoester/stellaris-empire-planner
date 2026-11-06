<script lang="ts">
	// A tech's name with its card as a popup — what the game's research card shows: tier, cost,
	// what it needs and leads to, its modifiers and unlocks, the flavour text last. The card is
	// fetched on first hover (`/api/tech/<key>`), so a page carries none. The empire dashboard shows
	// the same card (both build it with `#lib/techCard.ts`).
	import type { Snippet } from 'svelte';
	import { formatModifierValue, modifierColor, modifierLabel } from '#lib/civics.ts';
	import InfoPopup from '#lib/InfoPopup.svelte';
	import type { TechCard } from '#lib/server/db/tech.ts';

	let {
		tech,
		children,
		class: cls = ''
	}: { tech: string; children: Snippet; class?: string } = $props();

	let card = $state<TechCard | null | 'missing'>(null);
	const load = async () => {
		if (card !== null) return;
		try {
			const r = await fetch(`/api/tech/${encodeURIComponent(tech)}`);
			card = r.ok ? ((await r.json()) as TechCard) : 'missing';
		} catch {
			card = 'missing';
		}
	};
</script>

<span role="presentation" onpointerenter={load} onfocusin={load}
	><InfoPopup class={cls}>
		{@render children()}
		{#snippet content()}
			{#if card === null}
				<p class="opacity-60">Loading…</p>
			{:else if card === 'missing'}
				<p class="opacity-60">No card for this tech.</p>
			{:else}
				<p class="text-sm font-semibold">{card.title}</p>
				{#if card.facts.length}<p class="opacity-60">{card.facts.join(' · ')}</p>{/if}
				{#if card.modifiers.length}
					<ul class="space-y-0.5">
						{#each card.modifiers as m (m.key)}
							<li class="flex items-baseline gap-1.5">
								<span class="font-mono font-semibold {modifierColor(m)}"
									>{formatModifierValue(m)}</span
								>
								<span class="opacity-75">{modifierLabel(m)}</span>
							</li>
						{/each}
					</ul>
				{/if}
				{#if card.unlocks.length}
					<ul class="space-y-0.5 opacity-80">
						{#each card.unlocks as u, i (i)}<li>{u}</li>{/each}
					</ul>
				{/if}
				{#if card.description}<p class="italic opacity-60">{card.description}</p>{/if}
			{/if}
		{/snippet}
	</InfoPopup></span
>
