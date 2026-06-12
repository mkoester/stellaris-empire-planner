<script lang="ts">
	import type { PageData } from './$types';
	import type { Origin } from '$lib/server/db';
	import { dlcBadge } from '$lib/precursors';
	import { formatModifierValue, modifierColor, civicRequirementLines } from '$lib/civics';
	import { empire } from '$lib/empire.svelte';

	let { data }: { data: PageData } = $props();
	const origins = $derived(data.origins as Origin[]);

	let query = $state('');

	// Filter, then group by DLC (base game first, DLCs in first-appearance order).
	const groups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const filtered = q
			? origins.filter((o) => `${o.name ?? o.key} ${o.description ?? ''}`.toLowerCase().includes(q))
			: origins;
		const order: (string | null)[] = [];
		const by = new Map<string | null, Origin[]>();
		for (const o of filtered) {
			if (!by.has(o.requiredDlc)) {
				by.set(o.requiredDlc, []);
				order.push(o.requiredDlc);
			}
			by.get(o.requiredDlc)!.push(o);
		}
		return order
			.sort((a, b) => (a === null ? -1 : b === null ? 1 : 0))
			.map((dlc) => ({ dlc, label: dlc ?? 'Base game', items: by.get(dlc)! }));
	});
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<h1 class="text-2xl font-bold">Origins</h1>

	<input class="input max-w-sm" type="search" placeholder="Filter origins…" bind:value={query} />

	{#each groups as group (group.label)}
		<section class="space-y-3">
			<h2 class="flex items-center gap-2 text-lg font-semibold">
				{group.label}
				{#if group.dlc}
					<span class="rounded border px-1.5 py-0.5 text-[10px] font-normal {dlcBadge(group.dlc)}"
						>DLC</span
					>
				{/if}
				<span class="text-sm font-normal opacity-40">· {group.items.length}</span>
			</h2>

			<div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
				{#each group.items as origin (origin.key)}
					{@const reqs = civicRequirementLines(origin.requirements)}
					{@const selected = empire.draft.origin === origin.key}
					<button
						type="button"
						aria-pressed={selected}
						onclick={() => empire.setOrigin(selected ? null : origin.key)}
						class="space-y-2 rounded-lg border p-3 text-left transition-colors {selected
							? 'border-primary-500 bg-primary-500/10'
							: 'border-surface-400-500/30 hover:border-surface-400-500/60'}"
					>
						<h3 class="font-semibold">{origin.name ?? origin.key}</h3>

						{#if reqs.length}
							<div class="flex flex-wrap gap-1">
								{#each reqs as r, i (i)}
									<span
										class="rounded px-1.5 py-0.5 text-[10px] {r.type === 'require'
											? 'bg-emerald-500/12 text-emerald-300/90'
											: 'bg-red-500/12 text-red-300/90'}"
										>{r.type === 'require' ? 'needs' : 'excl.'} {r.text}</span
									>
								{/each}
							</div>
						{/if}

						{#if origin.modifiers.length}
							<ul class="space-y-0.5 text-xs">
								{#each origin.modifiers as mod (mod.key)}
									<li class="flex items-baseline justify-between gap-3">
										<span class="opacity-70">{mod.label ?? mod.key}</span>
										<span class="shrink-0 font-mono {modifierColor(mod)}"
											>{formatModifierValue(mod)}</span
										>
									</li>
								{/each}
							</ul>
						{/if}

						{#if origin.description}
							<p class="text-xs opacity-55">{origin.description}</p>
						{/if}
					</button>
				{/each}
			</div>
		</section>
	{/each}
</main>
