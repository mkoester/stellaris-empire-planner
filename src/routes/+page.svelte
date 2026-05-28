<script lang="ts">
	import type { PageData } from './$types';
	import type { Trait } from '$lib/server/db';

	let { data }: { data: PageData } = $props();

	type Archetype = 'BIOLOGICAL' | 'LITHOID' | 'MACHINE';

	const ARCHETYPES: { key: Archetype; label: string }[] = [
		{ key: 'BIOLOGICAL', label: 'Biological' },
		{ key: 'LITHOID', label: 'Lithoid' },
		{ key: 'MACHINE', label: 'Machine' }
	];

	const CATEGORY_LABELS: Record<string, string> = {
		normal: 'Species Traits',
		psionic: 'Psionic Traits',
		overtuned: 'Overtuned Traits',
		robotic: 'Synthetic Traits',
		cyborg: 'Cybernetic Traits',
		malleable: 'Malleable Traits',
		mutation: 'Mutation Traits'
	};

	const CATEGORY_ORDER = ['normal', 'robotic', 'psionic', 'overtuned', 'cyborg', 'malleable', 'mutation'];

	let archetype = $state<Archetype>('BIOLOGICAL');
	let selected = $state(new Set<string>());

	const archetypeConfig = $derived(data.archetypes[archetype]);
	const maxPoints = $derived(archetypeConfig?.traitPoints ?? 2);
	const maxTraits = $derived(archetypeConfig?.maxTraits ?? 5);
	const baseTrait = $derived(archetypeConfig?.baseTrait ?? null);

	// Clear selections incompatible with new archetype when it changes
	$effect(() => {
		const valid = new Set(
			data.traits.filter((t) => t.archetypes.includes(archetype)).map((t) => t.key)
		);
		const pruned = new Set([...selected].filter((k) => valid.has(k)));
		if (pruned.size !== selected.size) selected = pruned;
	});

	const visibleTraits = $derived(data.traits.filter((t) => t.archetypes.includes(archetype)));

	const traitsByCategory = $derived.by(() => {
		const groups = new Map<string, Trait[]>();
		for (const t of visibleTraits) {
			if (!groups.has(t.category)) groups.set(t.category, []);
			groups.get(t.category)!.push(t);
		}
		return groups;
	});

	const selectedTraits = $derived(data.traits.filter((t) => selected.has(t.key)));
	const pointsUsed = $derived(selectedTraits.reduce((sum, t) => sum + (t.cost ?? 0), 0));
	const pointsRemaining = $derived(maxPoints - pointsUsed);
	const traitCount = $derived(selected.size);

	const blockedByOpposite = $derived.by(() => {
		const blocked = new Set<string>();
		for (const key of selected) {
			const trait = data.traits.find((t) => t.key === key);
			if (trait) for (const opp of trait.opposites) blocked.add(opp);
		}
		return blocked;
	});

	function canToggle(trait: Trait): boolean {
		if (selected.has(trait.key)) return true;
		if (traitCount >= maxTraits) return false;
		if (pointsUsed + (trait.cost ?? 0) > maxPoints) return false;
		if (blockedByOpposite.has(trait.key)) return false;
		return true;
	}

	function toggle(trait: Trait) {
		const next = new Set(selected);
		if (next.has(trait.key)) {
			next.delete(trait.key);
		} else if (canToggle(trait)) {
			next.add(trait.key);
		}
		selected = next;
	}

	function formatKey(key: string): string {
		return key
			.replace(/^trait_/, '')
			.split('_')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}

	function costLabel(cost: number | null): string {
		if (cost === null) return '?';
		return cost > 0 ? `+${cost}` : `${cost}`;
	}

	function costClass(cost: number | null, selected: boolean): string {
		if (selected) return 'opacity-80';
		if (cost === null) return 'text-orange-400';
		if (cost < 0) return 'text-emerald-400';
		return 'text-amber-400';
	}
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<h1 class="text-2xl font-bold">Species Builder</h1>

	<!-- Archetype selector -->
	<div class="flex flex-wrap gap-2">
		{#each ARCHETYPES as arch}
			<button
				class="btn {archetype === arch.key ? 'preset-filled-primary-500' : 'preset-filled'}"
				onclick={() => (archetype = arch.key)}
			>
				{arch.label}
			</button>
		{/each}
	</div>

	<!-- Budget + selection summary -->
	<div class="card preset-filled p-4">
		<div class="mb-3 flex items-center justify-between text-sm">
			<span>
				<strong>{traitCount}</strong> / {maxTraits} traits &nbsp;·&nbsp;
				<strong
					class={pointsRemaining < 0
						? 'text-red-400'
						: pointsRemaining === 0
							? 'text-amber-400'
							: ''}
				>
					{pointsRemaining}
				</strong>
				/ {maxPoints} pts remaining
			</span>
			{#if traitCount > 0}
				<button class="btn text-xs preset-filled" onclick={() => (selected = new Set())}>
					Clear all
				</button>
			{/if}
		</div>

		<!-- Point budget bar -->
		<div class="bg-surface-200-800 h-2 w-full overflow-hidden rounded-full">
			<div
				class="h-full rounded-full transition-all {pointsRemaining < 0
					? 'bg-red-500'
					: 'bg-primary-500'}"
				style="width: {maxPoints > 0 ? Math.max(0, Math.min(100, (pointsUsed / maxPoints) * 100)) : 0}%"
			></div>
		</div>

		<!-- Base trait (always included, free, doesn't count toward picks) -->
		<div class="mt-3 flex flex-wrap gap-2">
			{#if baseTrait}
				<span
					class="flex cursor-default items-center gap-1 rounded border px-2 py-1 text-xs opacity-50 border-surface-400-500"
					title="Always included — 0 pts, not counted in picks"
				>
					<span>{formatKey(baseTrait)}</span>
					<span class="opacity-60">(base)</span>
				</span>
			{/if}
			{#each selectedTraits as trait}
				<button
					class="flex items-center gap-1 rounded px-2 py-1 text-xs preset-filled-primary-500 hover:opacity-80"
					onclick={() => toggle(trait)}
				>
					<span>{formatKey(trait.key)}</span>
					<span class="opacity-70">({costLabel(trait.cost)})</span>
					<span class="ml-1 opacity-50">×</span>
				</button>
			{/each}
			{#if traitCount === 0 && !baseTrait}
				<p class="text-sm opacity-50">No traits selected. Pick up to {maxTraits} below.</p>
			{/if}
		</div>
	</div>

	<!-- Trait list by category -->
	{#each CATEGORY_ORDER as category}
		{#if traitsByCategory.has(category)}
			{@const traits = traitsByCategory.get(category)!}
			<section>
				<h2 class="mb-3 text-lg font-semibold">{CATEGORY_LABELS[category] ?? category}</h2>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#each traits as trait}
						{@const isSelected = selected.has(trait.key)}
						{@const isBlockable = !isSelected && !canToggle(trait)}
						<button
							class="card text-left transition-all
								{isSelected
								? 'preset-filled-primary-500'
								: isBlockable
									? 'preset-filled opacity-35 cursor-not-allowed'
									: 'preset-filled card-hover cursor-pointer'}
								p-3"
							onclick={() => toggle(trait)}
							disabled={isBlockable}
						>
							<div class="flex min-h-10 flex-col justify-between gap-1">
								<span class="text-sm leading-tight font-medium">{formatKey(trait.key)}</span>
								<div class="flex items-center justify-between gap-1">
									<span class="font-mono text-xs {costClass(trait.cost, isSelected)}">
										{costLabel(trait.cost)} pt
									</span>
									{#if trait.required_dlc}
										<span
											class="rounded px-1 text-[10px] leading-tight opacity-70 bg-secondary-500 text-secondary-contrast-500"
										>
											DLC
										</span>
									{/if}
								</div>
							</div>
						</button>
					{/each}
				</div>
			</section>
		{/if}
	{/each}
</main>
