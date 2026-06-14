<script lang="ts">
	import type { PageData } from './$types';
	import type { ReferenceBuilding } from '$lib/server/db';
	import RuleText from '$lib/RuleText.svelte';
	import Tip from '$lib/Tip.svelte';

	let { data }: { data: PageData } = $props();
	const buildings = $derived(data.buildings as ReferenceBuilding[]);

	let query = $state('');

	const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	const num = (n: number) => (Number.isInteger(n) ? n : parseFloat(n.toFixed(2)));

	const CAT_ORDER = [
		'resource',
		'manufacturing',
		'research',
		'pop_assembly',
		'amenity',
		'amenities',
		'trade',
		'government',
		'army'
	];

	const groups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const list = q
			? buildings.filter((b) =>
					`${b.name ?? b.key} ${b.description ?? ''}`.toLowerCase().includes(q)
				)
			: buildings;
		const by = new Map<string, ReferenceBuilding[]>();
		for (const b of list) {
			const c = b.category ?? 'other';
			if (!by.has(c)) by.set(c, []);
			by.get(c)!.push(b);
		}
		const cats = [...by.keys()].sort((a, b) => {
			const ia = CAT_ORDER.indexOf(a);
			const ib = CAT_ORDER.indexOf(b);
			return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
		});
		return cats.map((c) => ({ category: c, label: titleCase(c), items: by.get(c)! }));
	});
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Buildings</h1>
		<p class="text-sm opacity-60">
			Reference for every building — base build cost, upkeep and the jobs it provides. Job counts
			use the Stellaris 4.0 ×100 scaling (200 = 2 jobs).
		</p>
	</div>

	<input class="input max-w-sm" type="search" placeholder="Filter buildings…" bind:value={query} />

	{#each groups as group (group.category)}
		<section class="space-y-3">
			<h2 class="text-lg font-semibold">
				{group.label}
				<span class="text-sm font-normal opacity-40">· {group.items.length}</span>
			</h2>
			<div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
				{#each group.items as b (b.key)}
					<div class="border-surface-400-500/30 flex h-full flex-col gap-2 rounded-lg border p-3">
						<h3 class="font-semibold">{b.name ?? b.key}</h3>

						{#if b.resources.length}
							<div class="flex flex-wrap gap-1">
								{#each b.resources as r (r.kind + r.resource)}
									<Tip
										text={r.kind}
										class="rounded px-1.5 py-0.5 text-[11px] {r.kind === 'produces'
											? 'bg-emerald-500/15 text-emerald-300/90'
											: r.kind === 'upkeep'
												? 'bg-red-500/15 text-red-300/90'
												: 'bg-surface-500/20 opacity-80'}"
									>
										{r.kind === 'produces' ? '+' : r.kind === 'upkeep' ? '−' : ''}{num(r.amount)}
										{titleCase(r.resource)}
									</Tip>
								{/each}
							</div>
						{/if}

						{#if b.jobs.length}
							<div class="flex flex-wrap gap-1">
								{#each b.jobs as j (j.job)}
									<span class="rounded bg-sky-500/15 px-1.5 py-0.5 text-[11px] text-sky-300/90">
										{titleCase(j.job)} ×{num(j.amount)}
									</span>
								{/each}
							</div>
						{/if}

						{#if b.description}
							<RuleText text={b.description} class="mt-auto text-xs opacity-55" />
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/each}
</main>
