<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import JumpLinks from '#lib/JumpLinks.svelte';
	import Tip from '#lib/Tip.svelte';
	import { formatModifierValue, modifierColor, modifierLabel } from '#lib/civics.ts';
	import { rewardText } from '#lib/ambitions.ts';
	import { triggerText } from '#lib/triggers.ts';

	let { data }: { data: PageData } = $props();

	const names = $derived(data.names ?? {});
	const fmt = (n: number) =>
		(Number.isInteger(n) ? n : parseFloat(n.toFixed(2))).toLocaleString('en');
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Ambitions</h1>
		<p class="max-w-3xl text-sm opacity-60">
			The paths an ascension perk starts: each earns its own currency from objectives, and each
			level reached grants a choice of perks.
		</p>
	</div>

	<JumpLinks links={data.ambitions.map((a) => ({ id: a.key, label: a.name ?? a.key }))} />

	{#each data.ambitions as a (a.key)}
		<section
			id={a.key}
			class="border-surface-400-500/30 scroll-mt-16 space-y-3 rounded-lg border p-3"
		>
			<header class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h2 class="text-lg font-semibold">{a.name ?? a.key}</h2>
				{#if a.currencyName ?? a.currency}
					<span class="text-xs opacity-60">currency: {a.currencyName ?? a.currency}</span>
				{/if}
				{#if a.startingPerks.length}
					<span class="text-xs opacity-60">
						started by
						{#each a.startingPerks as p, i (p.key)}{i > 0 ? ', ' : ''}<a
								href={resolve('/ascension-perks')}
								class="text-violet-300 underline decoration-dotted underline-offset-2"
							>
								{p.name ?? p.key}
							</a>{/each}
					</span>
				{/if}
			</header>
			{#if a.description}<p class="max-w-4xl text-xs whitespace-pre-line opacity-70">
					{a.description}
				</p>{/if}

			<ol class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{#each a.levels as lv (lv.key)}
					<li class="border-surface-400-500/20 space-y-1 rounded border p-2">
						<div class="flex flex-wrap items-baseline gap-2 text-sm">
							<span class="font-semibold">Level {lv.level}</span>
							{#if lv.name}<span class="opacity-70">{lv.name}</span>{/if}
							{#if lv.requiredCurrency}
								<span class="text-xs opacity-50">
									· {fmt(lv.requiredCurrency)}
									{a.currencyName ?? a.currency}
								</span>
							{/if}
						</div>
						{#if lv.requirements.length}
							<ul class="list-disc pl-4 text-[11px] opacity-60">
								{#each lv.requirements as r, i (i)}<li>{r}</li>{/each}
							</ul>
						{/if}
						<ul class="space-y-1.5">
							{#each lv.perks as p (p.key)}
								<li class="text-xs">
									<Tip text={p.description} class="font-medium">{p.name ?? p.key}</Tip>
									{#each p.modifiers as m, i (i)}
										<div class="flex items-baseline gap-1.5">
											{#if m.scope !== 'country'}<span class="text-[10px] opacity-45">
													{m.scope}
												</span>{/if}
											<span class="font-mono font-semibold {modifierColor(m)}">
												{formatModifierValue(m)}
											</span>
											<span class="opacity-75">{modifierLabel(m)}</span>
										</div>
									{/each}
									{#if !p.modifiers.length && p.description}
										<div class="text-[11px] opacity-55">{p.description}</div>
									{/if}
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ol>

			{#if a.objectives.length}
				<div>
					<h3 class="text-sm font-semibold">Objectives</h3>
					<table class="mt-1 w-full text-xs">
						<thead>
							<tr class="text-[10px] opacity-50">
								<th class="text-left font-normal">Objective</th>
								<th class="text-left font-normal">Reward ({a.currencyName ?? a.currency})</th>
							</tr>
						</thead>
						<tbody>
							{#each a.objectives as o (o.key)}
								<tr class="border-surface-400-500/10 border-t align-top">
									<td class="py-1 pr-3">
										<Tip text={o.description} class="font-medium">{o.name ?? o.key}</Tip>
										{#if o.recurring}<span class="text-[10px] opacity-50"> · repeats</span>{/if}
										{#if o.potential}
											<div class="text-[10px] opacity-50">
												Only for: {triggerText(o.potential, names)}
											</div>
										{/if}
									</td>
									<td class="py-1 font-mono">{rewardText(o.reward)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/each}
</main>
