<script lang="ts">
	// What each pick on a builder page adds to the starting capital: per pick, the
	// districts, zones and buildings the game's setup scripts give it (see $lib/startCapital).
	import { prettyKey } from '$lib/civics';
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
		pick = 'Pick'
	}: {
		rows: ContributionRow[];
		assumed: { field: keyof typeof CAPITAL_DEFAULTS; value: string }[]; // defaulted draft fields
		names: Record<string, string>;
		pick?: string; // the first column's heading
	} = $props();

	const name = (k: string) => names[k] ?? prettyKey(k);
	const shown = $derived(rows.filter((r) => r.items.length));
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

{#if shown.length}
	<section>
		<h2 class="mb-1 text-lg font-semibold">Starting Capital</h2>
		<p class="mb-4 text-sm opacity-50">
			{intro}
		</p>
		<table class="w-full text-xs">
			<thead>
				<tr class="border-surface-400-500/40 border-b">
					<th class="w-48 py-1.5 pr-4 text-left font-medium opacity-60">{pick}</th>
					<th class="px-3 py-1.5 text-left font-medium opacity-60">Adds</th>
				</tr>
			</thead>
			<tbody>
				{#each shown as row (row.key)}
					<tr class="border-surface-400-500/20 border-b hover:bg-surface-500/10">
						<td class="py-1.5 pr-4 font-medium {row.active ? 'text-primary-400' : 'opacity-70'}"
							>{row.label}</td
						>
						<td class="px-3 py-1.5">
							<div class="flex flex-wrap items-center gap-1.5">
								{#each row.items as c, i (i)}
									<span class="rounded px-1.5 py-0.5 {CHIP[c.kind]}"
										>{itemText(c)}{#if c.also.length}<span class="opacity-60">
												· with {c.also.map((r) => reasonText(r, names)).join(' + ')}</span
											>{/if}</span
									>
								{/each}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}
