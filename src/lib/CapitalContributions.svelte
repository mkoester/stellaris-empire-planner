<script lang="ts">
	// What each pick on a builder page adds to the starting capital: per pick, the
	// districts, zones and buildings the game's setup scripts give it (see $lib/startCapital).
	// `paired` lays out rows two by two, side by side, for picks that exclude each other
	// (an ethic and its opposite).
	import { prettyKey } from '$lib/civics';
	import type { ReferenceBuilding } from '$lib/server/db';
	import BuildingName from '$lib/BuildingName.svelte';
	import {
		reasonText,
		type CAPITAL_DEFAULTS,
		type Contribution,
		type ContributionRow
	} from '$lib/startCapital';

	let {
		rows,
		assumed,
		names,
		buildings,
		pick = 'Pick',
		paired = false
	}: {
		rows: ContributionRow[];
		assumed: { field: keyof typeof CAPITAL_DEFAULTS; value: string }[]; // defaulted draft fields
		names: Record<string, string>;
		buildings: Record<string, ReferenceBuilding>; // for the building popups
		pick?: string; // the first column's heading
		paired?: boolean;
	} = $props();

	const name = (k: string) => names[k] ?? prettyKey(k);
	// Paired rows keep their partner even when it adds nothing.
	const lines = $derived(
		paired
			? rows
					.map((r, i) => (i % 2 ? null : [r, rows[i + 1]]))
					.filter((p): p is ContributionRow[] => !!p && p.some((r) => r?.items.length))
			: rows.filter((r) => r.items.length).map((r) => [r])
	);
	const FIELD: Record<string, string> = {
		authority: 'government',
		origin: 'origin',
		speciesClass: 'species',
		planetClass: 'homeworld'
	};
	const intro = $derived(
		`What each ${pick.toLowerCase()} adds to the capital at game start, for your empire as planned` +
			(assumed.length
				? ` (not picked yet, so assumed: ${assumed
						.map((a) => `${name(a.value)} ${FIELD[a.field]}`)
						.join(', ')})`
				: '') +
			'.'
	);
	const itemText = (c: Contribution) =>
		c.kind === 'district'
			? `${c.amount! > 0 ? '+' : '−'}${Math.abs(c.amount!)} ${name(c.key)}`
			: c.kind === 'zone'
				? `${name(c.key)} zone`
				: name(c.key);
	const CHIP: Record<Contribution['kind'], string> = {
		district: 'bg-sky-500/15 text-sky-300/90',
		zone: 'bg-amber-500/15 text-amber-300/90',
		building: 'bg-emerald-500/15 text-emerald-300/90'
	};
</script>

{#snippet cells(row: ContributionRow | undefined)}
	<td class="py-1.5 pr-4 font-medium {row?.active ? 'text-primary-400' : 'opacity-70'}"
		>{row?.label ?? ''}</td
	>
	<td class="px-3 py-1.5">
		{#if row?.items.length}
			<div class="flex flex-wrap items-center gap-1.5">
				{#each row.items as c, i (i)}
					<span class="rounded px-1.5 py-0.5 {CHIP[c.kind]}"
						>{#if c.kind === 'building'}<BuildingName
								building={buildings[c.key]}
								label={itemText(c)}
							/>{:else}{itemText(c)}{/if}{#if c.also.length}<span class="opacity-60">
								· with {c.also.map((r) => reasonText(r, names)).join(' + ')}</span
							>{/if}</span
					>
				{/each}
			</div>
		{:else}
			<span class="opacity-20">—</span>
		{/if}
	</td>
{/snippet}

{#if lines.length}
	<section>
		<h2 class="mb-1 text-lg font-semibold">Starting Capital</h2>
		<p class="mb-4 text-sm opacity-50">{intro}</p>
		<table class="w-full text-xs">
			<thead>
				<tr class="border-surface-400-500/40 border-b">
					{#each paired ? [0, 1] : [0] as i (i)}
						<th class="w-40 py-1.5 pr-4 text-left font-medium opacity-60">{pick}</th>
						<th class="px-3 py-1.5 text-left font-medium opacity-60">Adds</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each lines as line (line[0].key)}
					<tr class="border-surface-400-500/20 border-b hover:bg-surface-500/10">
						{#each paired ? [0, 1] : [0] as i (i)}{@render cells(line[i])}{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}
