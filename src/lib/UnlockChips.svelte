<script lang="ts">
	// The council agendas and edicts a pick opens, as chips with a popup: what each gives and
	// what else it needs.
	import type { ConditionalModifier } from '$lib/server/db';
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';
	import { leafText, withAllDlc } from '$lib/triggers';
	import type { Trigger } from '$lib/server/db';
	import type { Unlock } from '$lib/unlocks';
	import InfoPopup from '$lib/InfoPopup.svelte';
	import RuleText from '$lib/RuleText.svelte';

	let { unlocks = [], names }: { unlocks?: Unlock[]; names: Record<string, string> } = $props();
	const KIND = { agenda: 'Agenda', edict: 'Edict' };
	// the simple conditions, DLC aside: single leaves at the top, negated or not; anything nested
	// (the Sacrifice edicts excluding each other) only counted
	const needs = (u: Unlock) => {
		const n = { ...names, ...u.needNames };
		const top = [u.potential, u.allow].flatMap((t) => {
			const x = t ? withAllDlc(t) : true;
			if (typeof x === 'boolean') return [];
			return 'leaf' in x || x.op !== 'and' ? [x] : x.args;
		});
		const simple = (x: Trigger): string | null =>
			'leaf' in x
				? leafText(x, n)
				: x.op === 'not' && 'leaf' in x.args[0]
					? `not ${leafText(x.args[0], n)}`
					: null;
		const texts = top.map(simple);
		const rest = texts.filter((t) => t === null).length;
		return [
			...new Set(texts.filter((t) => t !== null)),
			...(rest ? ['other conditions'] : [])
		].join(', ');
	};
</script>

{#snippet modList(title: string, mods: ConditionalModifier[])}
	{#if mods.length}
		<div class="space-y-0.5">
			<div class="text-[10px] uppercase opacity-45">{title}</div>
			<ul class="space-y-0.5">
				{#each mods as m, i (i)}
					<li class="flex items-baseline justify-between gap-3">
						<span class="opacity-70">{modifierLabel(m)}</span>
						<span class="shrink-0 font-mono {modifierColor(m)}">{formatModifierValue(m)}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{/snippet}

{#each unlocks as u (u.kind + u.key)}
	<InfoPopup class="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-200/90">
		{KIND[u.kind]}: {u.name}
		{#snippet content()}
			<div>
				<div class="text-sm font-semibold">{u.name}</div>
				<div class="opacity-55">{u.kind === 'agenda' ? 'Council agenda' : 'Edict'}</div>
			</div>
			{@render modList(u.kind === 'agenda' ? 'While launching' : 'While active', u.modifiers)}
			{@render modList('Once launched', u.finish)}
			{#if !u.modifiers.length && !u.finish.length}
				<p class="opacity-55">Its effect is scripted; the game describes it in its tooltip.</p>
			{/if}
			{#if needs(u)}<p class="opacity-70"><span class="opacity-60">Needs:</span> {needs(u)}</p>{/if}
			{#if u.description}<RuleText text={u.description} class="opacity-55" />{/if}
		{/snippet}
	</InfoPopup>
{/each}
