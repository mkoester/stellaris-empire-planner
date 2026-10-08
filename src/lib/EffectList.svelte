<script lang="ts">
	// The effects of a tradition/perk as the profile sees it (see effective()): modifiers,
	// with a "?" on those that only apply under a condition the profile can't settle,
	// then the custom tooltip text.
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';
	import Tip from '$lib/Tip.svelte';
	import type { Effective } from '$lib/traditions';
	import { triggerText } from '$lib/triggers';

	let { effect, names }: { effect: Effective; names: Record<string, string> } = $props();
</script>

{#if effect.modifiers.length}
	<ul class="space-y-0.5 text-xs">
		{#each effect.modifiers as { mod, state }, i (i)}
			<li class="flex items-baseline gap-1.5">
				<span class="font-mono font-semibold {modifierColor(mod)}">{formatModifierValue(mod)}</span>
				<span class="opacity-75">{modifierLabel(mod)}</span>
				{#if state === null && mod.potential}
					<Tip text={`Only if: ${triggerText(mod.potential, names)}`} class="text-[10px] opacity-60"
						>(if …)</Tip
					>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
{#if effect.tooltip}
	<p class="text-xs leading-relaxed whitespace-pre-line opacity-75">{effect.tooltip}</p>
{/if}
