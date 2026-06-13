<script lang="ts">
	import type { PageData } from './$types';
	import type { Job } from '$lib/server/db';
	import RuleText from '$lib/RuleText.svelte';

	let { data }: { data: PageData } = $props();
	const jobs = $derived(data.jobs as Job[]);

	let query = $state('');

	const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

	// Category display order (the rest follow alphabetically).
	const CAT_ORDER = [
		'ruler',
		'specialist',
		'worker',
		'complex_drone',
		'simple_drone',
		'maintenance_drone',
		'bio_trophy',
		'robot_servant',
		'slave',
		'chip_slave',
		'civilian',
		'criminal',
		'purge',
		'pre_sapients',
		'assimilation',
		'precursor'
	];

	const groups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const list = q
			? jobs.filter((j) => `${j.name ?? j.key} ${j.description ?? ''}`.toLowerCase().includes(q))
			: jobs;
		const by = new Map<string, Job[]>();
		for (const j of list) {
			const c = j.category ?? 'other';
			if (!by.has(c)) by.set(c, []);
			by.get(c)!.push(j);
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
		<h1 class="text-2xl font-bold">Jobs</h1>
		<p class="text-sm opacity-60">
			Reference for every pop job. Resources are the <strong>base</strong> figures — conditional bonuses,
			swaps and empire modifiers aren't included.
		</p>
	</div>

	<input class="input max-w-sm" type="search" placeholder="Filter jobs…" bind:value={query} />

	{#each groups as group (group.category)}
		<section class="space-y-3">
			<h2 class="text-lg font-semibold">
				{group.label}
				<span class="text-sm font-normal opacity-40">· {group.items.length}</span>
			</h2>
			<div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
				{#each group.items as job (job.key)}
					<div class="border-surface-400-500/30 flex h-full flex-col gap-2 rounded-lg border p-3">
						<h3 class="font-semibold">{job.name ?? job.key}</h3>
						{#if job.resources.length}
							<div class="flex flex-wrap gap-1">
								{#each job.resources as r (r.kind + r.resource)}
									<span
										class="rounded px-1.5 py-0.5 text-[11px] {r.kind === 'produces'
											? 'bg-emerald-500/15 text-emerald-300/90'
											: 'bg-red-500/15 text-red-300/90'}"
									>
										{r.kind === 'produces' ? sign(r.amount) : `−${r.amount}`}
										{titleCase(r.resource)}
									</span>
								{/each}
							</div>
						{/if}
						{#if job.description}
							<RuleText text={job.description} class="mt-auto text-xs opacity-55" />
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/each}
</main>
