<script lang="ts">
	import type { PageData } from './$types';
	import type { Trait, Modifier } from '$lib/server/db';

	let { data }: { data: PageData } = $props();

	type Archetype = 'BIOLOGICAL' | 'LITHOID' | 'MACHINE';

	const ARCHETYPES: { key: Archetype; label: string }[] = [
		{ key: 'BIOLOGICAL', label: 'Biological' },
		{ key: 'LITHOID', label: 'Lithoid' },
		{ key: 'MACHINE', label: 'Machine' }
	];

	const classLabelMap = $derived(new Map(data.speciesClasses.map((sc) => [sc.key, sc.label])));

	function formatClassKey(key: string): string {
		return classLabelMap.get(key) ?? key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
	}

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

	const visibleTraits = $derived(
		data.traits
			.filter((t) => t.archetypes.includes(archetype))
			.sort((a, b) => {
				const costDiff = (b.cost ?? -Infinity) - (a.cost ?? -Infinity);
				if (costDiff !== 0) return costDiff;
				return formatKey(a.key).localeCompare(formatKey(b.key));
			})
	);

	const traitsByCategory = $derived.by(() => {
		const groups = new Map<string, Trait[]>();
		for (const t of visibleTraits) {
			if (!groups.has(t.category)) groups.set(t.category, []);
			groups.get(t.category)!.push(t);
		}
		return groups;
	});

	type TraitGroup = { key: string; labels: string[]; colors: string[]; traits: Trait[] };

	const traitSubGroups = $derived.by(() => {
		const result = new Map<string, { unrestricted: Trait[]; groups: TraitGroup[] }>();
		for (const [catKey, catTraits] of traitsByCategory) {
			const unrestricted: Trait[] = [];
			const groupMap = new Map<string, TraitGroup>();
			for (const t of catTraits) {
				if (t.speciesClasses.length === 0) {
					unrestricted.push(t);
				} else {
					const gKey = [...t.speciesClasses].sort().join(',');
					if (!groupMap.has(gKey)) {
						const labels = t.speciesClasses.map(formatClassKey);
						groupMap.set(gKey, { key: gKey, labels, colors: labels.map(speciesClassColor), traits: [] });
					}
					groupMap.get(gKey)!.traits.push(t);
				}
			}
			result.set(catKey, { unrestricted, groups: [...groupMap.values()] });
		}
		return result;
	});

	let groupPhenotype = $state(true);

	const phenotypeGroups = $derived.by(() => {
		const catTraits = traitsByCategory.get('phenotype') ?? [];
		const unrestricted: Trait[] = [];
		const classMap = new Map<string, { label: string; color: string; traits: Trait[] }>();
		for (const t of catTraits) {
			if (t.speciesClasses.length === 0) {
				unrestricted.push(t);
			} else {
				for (const cls of t.speciesClasses) {
					if (!classMap.has(cls)) {
						const label = formatClassKey(cls);
						classMap.set(cls, { label, color: speciesClassColor(label), traits: [] });
					}
					classMap.get(cls)!.traits.push(t);
				}
			}
		}
		return { unrestricted, groups: [...classMap.values()] };
	});

	const categoryColorMap = $derived(
		new Map(data.traitCategories.map((c) => [c.key, c.colorHex ?? '#888']))
	);

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

	function speciesClassColor(label: string): string {
		// DJB2 hash → hue, fixed saturation/lightness for readability in any theme
		let h = 5381;
		for (let i = 0; i < label.length; i++) h = (((h << 5) + h) ^ label.charCodeAt(i)) >>> 0;
		return `hsl(${h % 360}, 55%, 52%)`;
	}

	function costClass(cost: number | null, selected: boolean): string {
		if (selected) return 'opacity-80';
		if (cost === null) return 'text-orange-400';
		if (cost < 0) return 'text-emerald-400';
		return 'text-amber-400';
	}

	// Keys whose values are plain unit counts, not percentages
	const FLAT_UNIT_KEYS = new Set(['negative_leader_traits_species']);

	function formatModifier(mod: Modifier): string {
		const sign = mod.value > 0 ? '+' : '';
		if (FLAT_UNIT_KEYS.has(mod.key)) {
			return `${sign}${mod.value}`;
		}
		if (mod.key.endsWith('_add')) {
			if (Math.abs(mod.value) < 1) {
				// Sub-1 _add values are on a 0–1 percentage scale (e.g. habitability floor/ceil)
				return `${sign}${Math.round(mod.value * 100)}%`;
			}
			const n = Number.isInteger(mod.value) ? mod.value : parseFloat(mod.value.toFixed(2));
			return `${sign}${n}`;
		}
		return `${sign}${Math.round(mod.value * 100)}%`;
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

	{#snippet traitCard(trait: Trait, borderColor: string)}
		{@const isSelected = selected.has(trait.key)}
		{@const isBlockable = !isSelected && !canToggle(trait)}
		{@const debug = data.debugDisableSelection}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<svelte:element
			this={debug ? 'div' : 'button'}
			class="card relative text-left transition-all
				{isSelected && !debug
				? 'preset-filled-primary-500'
				: isBlockable && !debug
					? 'preset-filled opacity-35 cursor-not-allowed'
					: debug
						? 'preset-filled cursor-text select-text'
						: 'preset-filled card-hover cursor-pointer'}
				p-3"
			style="border-top: 2px solid {borderColor}"
			onclick={debug ? undefined : () => toggle(trait)}
			disabled={!debug && isBlockable}
		>
			<span class="absolute left-1.5 top-1.5 font-mono text-[10px] leading-tight {costClass(trait.cost, isSelected)}">
				{costLabel(trait.cost)}
			</span>
			{#if trait.required_dlc}
				<span
					class="absolute right-1.5 top-1.5 rounded px-1 text-[10px] leading-tight bg-secondary-500 text-secondary-contrast-500"
				>
					{trait.required_dlc}
				</span>
			{/if}
			<div class="flex flex-col gap-1 pt-4">
				<span class="text-sm leading-tight font-medium {!isSelected && trait.cost !== null && trait.cost < 0 ? 'text-red-400' : ''}">{formatKey(trait.key)}</span>
				{#if trait.modifiers.length > 0}
					<ul class="space-y-0.5">
						{#each trait.modifiers as mod}
							<li class="flex items-baseline justify-between gap-1 text-[10px]">
								<span class="opacity-60 leading-tight">{mod.label ?? mod.key}</span>
								<span class="font-mono shrink-0 {mod.value > 0 ? 'text-emerald-400' : 'text-red-400'}">{formatModifier(mod)}</span>
							</li>
						{/each}
					</ul>
				{/if}
				{#if trait.speciesClasses.length > 0}
					<div class="flex flex-wrap items-center gap-1">
						{#each trait.speciesClasses as cls}
							{@const clsLabel = formatClassKey(cls)}
							{@const clsColor = speciesClassColor(clsLabel)}
							<span
								class="rounded px-1 text-[10px] leading-tight opacity-80"
								style="background-color: {clsColor}33; border: 1px solid {clsColor}88; color: {clsColor}"
								title="Requires {clsLabel} species"
							>
								{clsLabel}
							</span>
						{/each}
					</div>
				{/if}
			</div>
		</svelte:element>
	{/snippet}

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
		{#if baseTrait}
			<div class="mt-3">
				<span
					class="flex cursor-default items-center gap-1 rounded border px-2 py-1 text-xs opacity-50 border-surface-400-500"
					title="Always included — 0 pts, not counted in picks"
				>
					<span>{formatKey(baseTrait)}</span>
					<span class="opacity-60">(base)</span>
				</span>
			</div>
		{/if}
		{#if traitCount > 0}
			<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each selectedTraits as trait}
					{@render traitCard(trait, categoryColorMap.get(trait.category) ?? '#888')}
				{/each}
			</div>
		{:else if !baseTrait}
			<p class="mt-3 text-sm opacity-50">No traits selected. Pick up to {maxTraits} below.</p>
		{/if}
	</div>

	<!-- Category legend -->
	{#if traitsByCategory.size > 0}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs opacity-70">
			{#each data.traitCategories.filter((c) => traitsByCategory.has(c.key)) as cat}
				<span class="flex items-center gap-1.5">
					<span
						class="inline-block h-2.5 w-2.5 rounded-sm"
						style="background-color: {cat.colorHex ?? '#888'}"
					></span>
					{cat.label}
				</span>
			{/each}
		</div>
	{/if}

	<!-- Trait list by category -->
	{#each data.traitCategories as cat}
		{#if traitsByCategory.has(cat.key)}
			{@const color = cat.colorHex ?? '#888'}
			<section>
				<div class="mb-3 flex items-center justify-between">
					<h2 class="pl-3 text-lg font-semibold" style="border-left: 3px solid {color}">
						{cat.label}
					</h2>
					{#if cat.key === 'phenotype'}
						<div class="flex gap-1">
							<button
								class="btn text-xs {!groupPhenotype ? 'preset-filled-primary-500' : 'preset-filled'}"
								onclick={() => (groupPhenotype = false)}
							>
								Flat
							</button>
							<button
								class="btn text-xs {groupPhenotype ? 'preset-filled-primary-500' : 'preset-filled'}"
								onclick={() => (groupPhenotype = true)}
							>
								By phenotype
							</button>
						</div>
					{/if}
				</div>

				{#if cat.key === 'phenotype' && groupPhenotype}
					{#if phenotypeGroups.unrestricted.length > 0}
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{#each phenotypeGroups.unrestricted as trait}
								{@render traitCard(trait, color)}
							{/each}
						</div>
					{/if}
					{#each phenotypeGroups.groups as group}
						<div class="mt-4">
							<h3
								class="mb-2 pl-2 text-sm font-medium opacity-60"
								style="border-left: 2px solid {group.color}"
							>
								{group.label}
							</h3>
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
								{#each group.traits as trait}
									{@render traitCard(trait, color)}
								{/each}
							</div>
						</div>
					{/each}
				{:else if cat.key === 'phenotype'}
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{#each traitsByCategory.get(cat.key)! as trait}
							{@render traitCard(trait, color)}
						{/each}
					</div>
				{:else}
					{@const subGroups = traitSubGroups.get(cat.key)!}
					{#if subGroups.unrestricted.length > 0}
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{#each subGroups.unrestricted as trait}
								{@render traitCard(trait, color)}
							{/each}
						</div>
					{/if}
					{#each subGroups.groups as group}
						<div class="mt-4">
							<h3
								class="mb-2 pl-2 text-sm font-medium opacity-60"
								style="border-left: 2px solid {group.colors[0]}"
							>
								{group.labels.join(' · ')}
							</h3>
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
								{#each group.traits as trait}
									{@render traitCard(trait, color)}
								{/each}
							</div>
						</div>
					{/each}
				{/if}
			</section>
		{/if}
	{/each}
</main>
