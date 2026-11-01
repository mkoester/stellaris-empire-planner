<script lang="ts">
	// "Help me choose": the council seats civics open, side by side — what each gives per level of
	// its leader, who can hold it — to pick a civic by its seat. Folded by default.
	import type { Civic, CouncilPosition } from '$lib/server/db';
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';
	import { councilSeatRows, seatClasses, type SeatSort } from '$lib/council';
	import ConflictBadge from '$lib/ConflictBadge.svelte';
	import RuleText from '$lib/RuleText.svelte';

	let {
		civics,
		council,
		query = '',
		selected,
		reasons,
		ontoggle
	}: {
		civics: Civic[];
		council: Record<string, CouncilPosition>;
		query?: string;
		selected: string[];
		reasons: (civicKey: string) => string[];
		ontoggle: (civicKey: string) => void;
	} = $props();

	let leaderClass: string | null = $state(null);
	let sort: SeatSort = $state('seat');
	const classes = $derived(seatClasses(council));
	const rows = $derived(councilSeatRows(civics, council, { query, leaderClass, sort }));
	const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
</script>

<details class="border-surface-400-500/30 rounded-lg border p-3">
	<summary class="cursor-pointer font-semibold">
		Council seats
		<span class="text-sm font-normal opacity-40"
			>· {rows.length} — choose a civic by the seat it opens</span
		>
	</summary>
	<div class="mt-3 flex flex-wrap items-center gap-3 text-xs">
		<label
			>Leader
			<select class="select w-auto py-0.5 text-xs" bind:value={leaderClass}>
				<option value={null}>any</option>
				{#each classes as c (c)}<option value={c}>{cap(c)}</option>{/each}
			</select></label
		>
		<label
			>Sort by
			<select class="select w-auto py-0.5 text-xs" bind:value={sort}>
				<option value="seat">seat</option>
				<option value="civic">civic</option>
				<option value="group">civic type</option>
			</select></label
		>
		<span class="opacity-50">The filter above searches seats and their effects too.</span>
	</div>
	<table class="mt-2 w-full text-left text-xs">
		<thead class="opacity-60">
			<tr>
				<th class="py-1 pr-3">Seat</th>
				<th class="py-1 pr-3">Civic</th>
				<th class="py-1 pr-3">Leader</th>
				<th class="py-1">Per leader level</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.civic.key)}
				{@const on = selected.includes(r.civic.key)}
				<tr class="border-surface-400-500/20 border-t align-top">
					<td class="py-1 pr-3 font-medium">{r.seat.name ?? r.seat.key}</td>
					<td class="py-1 pr-3">
						<button
							type="button"
							aria-pressed={on}
							class="rounded px-1.5 py-0.5 text-left {on
								? 'preset-filled-primary-500'
								: 'hover:bg-surface-500/20'}"
							onclick={() => ontoggle(r.civic.key)}>{r.civic.name ?? r.civic.key}</button
						>
						<span class="opacity-40">{r.group}</span>
						<ConflictBadge reasons={reasons(r.civic.key)} />
					</td>
					<td class="py-1 pr-3 opacity-70">{r.seat.leaderClasses.map(cap).join(' / ')}</td>
					<td class="py-1">
						<ul class="space-y-0.5">
							{#each r.seat.modifiers as m (m.key)}
								<li class="flex items-baseline justify-between gap-3">
									<span class="opacity-70">{modifierLabel(m)}</span>
									<span class="shrink-0 font-mono {modifierColor(m)}">{formatModifierValue(m)}</span
									>
								</li>
							{/each}
						</ul>
						{#if r.seat.effect}<RuleText text={r.seat.effect} class="opacity-60" />{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</details>
