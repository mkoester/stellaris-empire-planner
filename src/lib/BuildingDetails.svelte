<script lang="ts">
	// A building's numbers: build cost / upkeep / output, the jobs it provides, its other
	// modifiers and its description. Shared by the Buildings page cards and the building
	// popups on the Civics / Origins cards.
	import type { ReferenceBuilding } from '$lib/server/db';
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';
	import { ascensionPerkName } from '$lib/precursors';
	import RuleText from '$lib/RuleText.svelte';
	import Tip from '$lib/Tip.svelte';

	let { building: b }: { building: ReferenceBuilding } = $props();

	const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	const num = (n: number) => (Number.isInteger(n) ? n : parseFloat(n.toFixed(2)));
	const SCOPE_NOTE: Record<string, string> = {
		country: 'empire-wide',
		system: 'in the system',
		station: 'on the starbase'
	};
</script>

{#if b.resources.length}
	<div class="flex flex-wrap gap-1">
		{#each b.resources as r (r.kind + r.resource)}
			<Tip
				text={r.kind}
				class="rounded px-1.5 py-0.5 text-[11px] {r.kind === 'produces'
					? 'bg-emerald-500/15 text-emerald-300/90'
					: r.kind === 'upkeep'
						? 'bg-red-500/15 text-red-300/90'
						: 'bg-surface-500/20 opacity-80'}"
			>
				{r.kind === 'produces' ? '+' : r.kind === 'upkeep' ? '−' : ''}{num(r.amount)}
				{titleCase(r.resource)}
			</Tip>
		{/each}
	</div>
{/if}

{#if b.jobs.length}
	<div class="flex flex-wrap gap-1">
		{#each b.jobs as j (j.job)}
			<span class="rounded bg-sky-500/15 px-1.5 py-0.5 text-[11px] text-sky-300/90">
				{titleCase(j.job)} ×{num(j.amount)}
			</span>
		{/each}
	</div>
{/if}

{#if b.modifiers.length}
	<ul class="space-y-0.5 text-xs">
		{#each b.modifiers as m, i (i)}
			<li class="flex items-baseline justify-between gap-3">
				<span class="opacity-70">
					{modifierLabel(m)}
					{#if SCOPE_NOTE[m.scope]}<span class="opacity-50">({SCOPE_NOTE[m.scope]})</span>{/if}
					{#if m.condition}<span class="opacity-50">
							(with {ascensionPerkName(m.condition)})</span
						>{/if}
				</span>
				<span class="shrink-0 font-mono {modifierColor(m)}">{formatModifierValue(m)}</span>
			</li>
		{/each}
	</ul>
{/if}

{#if b.description}
	<RuleText text={b.description} class="mt-auto text-xs opacity-55" />
{/if}
