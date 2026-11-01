<script lang="ts">
	// "Help me choose": the council agendas and edicts a civic, origin or authority opens, side by
	// side, each pick a button that picks it. Folded by default.
	import ConflictBadge from '$lib/ConflictBadge.svelte';
	import UnlockChips from '$lib/UnlockChips.svelte';
	import type { Pick, PickKind, Unlock } from '$lib/unlocks';

	let {
		unlocks,
		names,
		isPicked,
		reasons,
		ontoggle
	}: {
		unlocks: Unlock[];
		names: Record<string, string>;
		isPicked: (p: Pick) => boolean;
		reasons: (p: Pick) => string[];
		ontoggle: (p: Pick) => void;
	} = $props();

	const KINDS: PickKind[] = ['authority', 'origin', 'civic'];
	const LABEL: Record<PickKind, string> = {
		authority: 'Authority',
		origin: 'Origin',
		civic: 'Civic'
	};
	let hideConflicts = $state(false);
	// one row per pick, with everything it opens; picks by kind, then name
	const rows = $derived.by(() => {
		const by = new Map<string, { pick: Pick; unlocks: Unlock[] }>();
		for (const u of unlocks)
			for (const p of u.picks) {
				const id = `${p.kind}:${p.key}`;
				(by.get(id) ?? by.set(id, { pick: p, unlocks: [] }).get(id)!).unlocks.push(u);
			}
		const name = (p: Pick) => names[p.key] ?? p.key;
		return [...by.values()]
			.filter((r) => !hideConflicts || isPicked(r.pick) || !reasons(r.pick).length)
			.sort(
				(a, b) =>
					KINDS.indexOf(a.pick.kind) - KINDS.indexOf(b.pick.kind) ||
					name(a.pick).localeCompare(name(b.pick))
			);
	});
</script>

<details class="border-surface-400-500/30 rounded-lg border p-3">
	<summary class="cursor-pointer font-semibold">
		Agendas and edicts
		<span class="text-sm font-normal opacity-40"
			>· {rows.length} — the council agendas and edicts a civic, origin or authority opens</span
		>
	</summary>
	<div class="mt-3 flex flex-wrap items-center gap-3 text-xs">
		<label
			><input type="checkbox" class="checkbox" bind:checked={hideConflicts} /> hide conflicting picks</label
		>
		<span class="opacity-50">Hover a chip for what it gives and what else it needs.</span>
	</div>
	<table class="mt-2 w-full text-left text-xs">
		<thead class="opacity-60">
			<tr>
				<th class="py-1 pr-3">Pick</th>
				<th class="py-1">Opens</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.pick.kind + r.pick.key)}
				{@const on = isPicked(r.pick)}
				<tr class="border-surface-400-500/20 border-t align-top">
					<td class="w-72 py-1 pr-3">
						<button
							type="button"
							aria-pressed={on}
							class="rounded px-1.5 py-0.5 text-left {on
								? 'preset-filled-primary-500'
								: 'hover:bg-surface-500/20'}"
							onclick={() => ontoggle(r.pick)}>{names[r.pick.key] ?? r.pick.key}</button
						>
						<span class="opacity-40">{LABEL[r.pick.kind]}</span>
						<ConflictBadge reasons={reasons(r.pick)} />
					</td>
					<td class="py-1"
						><div class="flex flex-wrap gap-1"><UnlockChips unlocks={r.unlocks} {names} /></div></td
					>
				</tr>
			{/each}
		</tbody>
	</table>
</details>
