<script lang="ts">
	// The effects of a tradition/perk as the profile sees it (see effective()): modifiers,
	// with "(if …)" on those that only apply under a condition the profile can't settle,
	// then the custom tooltip text. Edicts/agendas it unlocks get a hover tooltip (federation
	// types also link to their card): where the text names them, on the name itself;
	// otherwise on an extra "Unlocks …" line.
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';
	import FederationLink from '$lib/FederationLink.svelte';
	import Tip from '$lib/Tip.svelte';
	import { linkify, type Effective, type Unlock } from '$lib/traditions';
	import { triggerText } from '$lib/triggers';

	let {
		effect,
		names,
		unlocks = []
	}: { effect: Effective; names: Record<string, string>; unlocks?: Unlock[] } = $props();

	const parts = $derived(
		effect.tooltip
			? linkify(
					effect.tooltip,
					unlocks.map((u) => u.name)
				)
			: []
	);
	const unmentioned = $derived(unlocks.filter((u, i) => !parts.some((p) => p.index === i)));
</script>

{#snippet unlockName(u: Unlock, text: string)}
	{#if u.kind === 'federation'}
		<FederationLink key={u.key} name={text} tip={u.tip} />
	{:else}
		<Tip
			text={u.tip}
			class="underline decoration-dotted underline-offset-2 {u.kind === 'edict'
				? 'text-sky-300'
				: 'text-amber-300'}">{text}</Tip
		>
	{/if}
{/snippet}

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
	<p class="text-xs leading-relaxed whitespace-pre-line opacity-75">
		{#each parts as part, i (i)}{#if part.index === null}{part.text}{:else}{@render unlockName(
					unlocks[part.index],
					part.text
				)}{/if}{/each}
	</p>
{/if}
{#if unmentioned.length}
	<p class="text-xs opacity-75">
		{#each unmentioned as u, i (u.key)}{i > 0 ? ', ' : ''}Unlocks {u.kind}:
			{@render unlockName(u, u.name)}{/each}
	</p>
{/if}
