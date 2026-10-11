<script lang="ts">
	// The council seat a civic opens, as a chip with a popup: who can hold it and what it
	// gives per level of the assigned leader.
	import type { CouncilPosition } from '$lib/server/db';
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';
	import InfoPopup from '$lib/InfoPopup.svelte';
	import RuleText from '$lib/RuleText.svelte';

	let { position: c }: { position: CouncilPosition } = $props();
	const classes = $derived(
		c.leaderClasses.map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(' / ')
	);
</script>

<InfoPopup class="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-200/90">
	Council: {c.name ?? c.key}
	{#snippet content()}
		<div>
			<div class="text-sm font-semibold">{c.name ?? c.key}</div>
			<div class="opacity-55">
				Council position{classes ? ` · ${classes}` : ''}
			</div>
		</div>
		{#if c.modifiers.length}
			<div class="space-y-0.5">
				<div class="text-[10px] uppercase opacity-45">Per leader level</div>
				<ul class="space-y-0.5">
					{#each c.modifiers as m (m.key)}
						<li class="flex items-baseline justify-between gap-3">
							<span class="opacity-70">{modifierLabel(m)}</span>
							<span class="shrink-0 font-mono {modifierColor(m)}">{formatModifierValue(m)}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if c.effect}<RuleText text={c.effect} class="opacity-70" />{/if}
		{#if c.description}<p class="opacity-55">{c.description}</p>{/if}
	{/snippet}
</InfoPopup>
