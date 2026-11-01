<script lang="ts">
	// "Help me choose" for a MegaCorp (and overlords): the branch office buildings — or holdings —
	// with what each gives the host colony and the owner, and the civics that add to them, each
	// civic a button that picks it. Folded by default.
	import type { Civic, OwnedBuilding, OwnedBuildingEffect } from '$lib/server/db';
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';
	import {
		buildingJobs,
		civicBoosts,
		conditionText,
		jobCount,
		jobNames,
		splitEffects
	} from '$lib/branchOffices';
	import ConflictBadge from '$lib/ConflictBadge.svelte';

	let {
		title,
		note,
		buildings,
		civics,
		selected,
		reasons,
		ontoggle,
		ownerLabel
	}: {
		title: string;
		note: string;
		buildings: OwnedBuilding[];
		civics: Civic[];
		selected: string[];
		reasons: (civicKey: string) => string[];
		ontoggle: (civicKey: string) => void;
		ownerLabel: string; // where `country` effects go: "capital", "overlord"
	} = $props();

	// the job filter: buildings that give or add to any of the jobs picked; none picked, all
	let jobFilter: string[] = $state([]);
	const jobsOf = $derived(new Map(buildings.map((b) => [b.key, buildingJobs(b)])));
	const allJobs = $derived(jobNames(buildings));
	const shown = $derived(
		jobFilter.length
			? buildings.filter((b) => jobsOf.get(b.key)!.some((j) => jobFilter.includes(j.name)))
			: buildings
	);
	const toggleJob = (name: string) =>
		(jobFilter = jobFilter.includes(name)
			? jobFilter.filter((n) => n !== name)
			: [...jobFilter, name]);
	const boosts = $derived(civicBoosts(shown, civics));
	const civicName = $derived(new Map(civics.map((c) => [c.key, c.name ?? c.key])));
	const where = (e: OwnedBuildingEffect) => (e.scope === 'planet' ? 'colony' : ownerLabel);
	const num = (n: number) => (Number.isInteger(n) ? n : parseFloat(n.toFixed(2)));
	const title_ = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
</script>

{#snippet effect(e: OwnedBuildingEffect, showWhere: boolean)}
	{@const jobs = jobCount(e)}
	<li class="flex items-baseline justify-between gap-3">
		<span class="opacity-70"
			>{#if showWhere}<span class="opacity-60">{where(e)}:</span>
			{/if}{modifierLabel(e.modifier)}</span
		>
		<span
			class="shrink-0 font-mono {modifierColor(e.modifier)}"
			title={jobs === null
				? undefined
				: `${num(e.modifier.value)} workforce: ${num(jobs)} job${jobs === 1 ? '' : 's'}`}
			>{formatModifierValue(e.modifier)}</span
		>
	</li>
{/snippet}

{#snippet civicButton(key: string)}
	{@const on = selected.includes(key)}
	<button
		type="button"
		aria-pressed={on}
		class="rounded px-1.5 py-0.5 text-left {on
			? 'preset-filled-primary-500'
			: 'hover:bg-surface-500/20'}"
		onclick={() => ontoggle(key)}>{civicName.get(key) ?? key}</button
	>
	<ConflictBadge reasons={reasons(key)} />
{/snippet}

<details class="border-surface-400-500/30 rounded-lg border p-3">
	<summary class="cursor-pointer font-semibold">
		{title}
		<span class="text-sm font-normal opacity-40">· {buildings.length} — {note}</span>
	</summary>

	{#if allJobs.length}
		<div class="mt-3 flex flex-wrap items-center gap-1 text-xs">
			<span class="mr-1 opacity-60">Jobs</span>
			{#each allJobs as name (name)}
				{@const on = jobFilter.includes(name)}
				<button
					type="button"
					aria-pressed={on}
					class="rounded-full border px-2 py-0.5 {on
						? 'border-transparent preset-filled-primary-500'
						: 'border-surface-400-500/40 hover:bg-surface-500/20'}"
					onclick={() => toggleJob(name)}>{name}</button
				>
			{/each}
			{#if jobFilter.length}
				<button
					type="button"
					class="ml-1 underline opacity-60 hover:opacity-100"
					onclick={() => (jobFilter = [])}>all ({shown.length} of {buildings.length} shown)</button
				>
			{/if}
		</div>
	{/if}

	{#if boosts.length}
		<h3 class="mt-3 text-sm font-semibold">Civics that add to them</h3>
		<table class="mt-1 w-full text-left text-xs">
			<tbody>
				{#each boosts as b (b.civic.key)}
					<tr class="border-surface-400-500/20 border-t align-top">
						<td class="w-56 py-1 pr-3">{@render civicButton(b.civic.key)}</td>
						<td class="py-1">
							{#each b.buildings as row (row.building.key)}
								<div class="mb-1">
									<span class="font-medium">{row.building.name ?? row.building.key}</span>
									<ul class="space-y-0.5">
										{#each row.effects as e, i (i)}{@render effect(e, true)}{/each}
									</ul>
								</div>
							{/each}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<h3 class="mt-4 text-sm font-semibold">Every building</h3>
	<div class="mt-1 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
		{#each shown as b (b.key)}
			{@const s = splitEffects(b)}
			<div class="border-surface-400-500/30 space-y-1 rounded border p-2 text-xs">
				<div class="font-semibold">{b.name ?? b.key}</div>
				{#if jobsOf.get(b.key)!.length}
					<div class="flex flex-wrap gap-1">
						{#each jobsOf.get(b.key)! as j (j.name)}
							<span
								class="rounded-full px-1.5 text-[10px] {jobFilter.includes(j.name)
									? 'preset-filled-primary-500'
									: 'bg-surface-500/20'}"
								title={[j.adds && 'gives these jobs', j.boosts && 'adds to their output']
									.filter(Boolean)
									.join(', ')}>{j.name}{j.adds ? '' : ' ↑'}</span
							>
						{/each}
					</div>
				{/if}
				{#if b.resources.length}
					<div class="opacity-70">
						{#each b.resources as r (r.kind + r.resource)}
							<span class="mr-2"
								>{r.kind === 'produces'
									? `+${num(r.amount)}`
									: r.kind === 'upkeep'
										? `−${num(r.amount)}`
										: num(r.amount)}
								{title_(r.resource)}
								<span class="opacity-50"
									>{r.kind === 'produces' ? `to the ${ownerLabel}` : r.kind}</span
								></span
							>
						{/each}
					</div>
				{/if}
				{#if b.jobs.length || s.colony.length}
					<div class="text-[10px] uppercase opacity-45">The colony gets</div>
					<ul class="space-y-0.5">
						{#each b.jobs as j (j.job)}
							<li class="flex justify-between gap-3">
								<span class="opacity-70">{j.name ?? title_(j.job)} Jobs</span>
								<span
									class="font-mono"
									title="{num(j.amount)} workforce: {num(j.amount / 100)} job{j.amount === 100
										? ''
										: 's'}">+{num(j.amount)}</span
								>
							</li>
						{/each}
						{#each s.colony as e, i (i)}{@render effect(e, false)}{/each}
					</ul>
				{/if}
				{#if s.owner.length}
					<div class="text-[10px] uppercase opacity-45">The {ownerLabel} gets</div>
					<ul class="space-y-0.5">
						{#each s.owner as e, i (i)}{@render effect(e, false)}{/each}
					</ul>
				{/if}
				{#if s.byCivic.length}
					<div class="text-[10px] uppercase opacity-45">With a civic</div>
					<ul class="space-y-0.5">
						{#each s.byCivic as e, i (i)}
							<li class={selected.includes(e.ownerCivic!) ? '' : 'opacity-60'}>
								<span class="opacity-70">{civicName.get(e.ownerCivic!) ?? e.ownerCivic}:</span>
								<ul class="pl-2">{@render effect(e, true)}</ul>
							</li>
						{/each}
					</ul>
				{/if}
				{#if s.other.length}
					<div class="text-[10px] uppercase opacity-45">Only if</div>
					<ul class="space-y-0.5 opacity-60">
						{#each s.other as e, i (i)}
							<li>
								<span class="italic">{conditionText(e.condition!)}</span>
								<ul class="pl-2">{@render effect(e, true)}</ul>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/each}
	</div>
</details>
