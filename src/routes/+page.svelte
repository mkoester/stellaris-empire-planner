<script lang="ts">
	import type { PageData } from './$types';
	import type { Trait } from '$lib/server/db';
	import { empire } from '$lib/empire.svelte';
	import { formatModifierValue } from '$lib/civics';

	let { data }: { data: PageData } = $props();

	// Top-level choice: Biological (includes Lithoid) or Machine
	type ArchetypeGroup = 'BIOLOGICAL' | 'MACHINE';
	const ARCHETYPE_GROUPS: { key: ArchetypeGroup; label: string }[] = [
		{ key: 'BIOLOGICAL', label: 'Biological' },
		{ key: 'MACHINE', label: 'Machine' }
	];

	const classLabelMap = $derived(new Map(data.speciesClasses.map((sc) => [sc.key, sc.label])));

	function formatClassKey(key: string): string {
		return classLabelMap.get(key) ?? key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
	}

	// Trait selection is backed by the shared empire draft; the archetype/class are
	// local view state (which traits the picker shows), synced from the draft on load.
	const deriveArchetype = (traits: string[]): ArchetypeGroup =>
		traits.includes('trait_machine') ? 'MACHINE' : 'BIOLOGICAL';

	let archetypeGroup = $state<ArchetypeGroup>(deriveArchetype(empire.draft.traits));
	let selectedClassKey = $state<string | null>(null);
	const selected = $derived(new Set(empire.draft.traits));
	let activeTags = $state(new Set<string>());

	// When an empire is loaded elsewhere (generation bumps), follow its archetype so
	// the loaded traits stay visible (and aren't pruned).
	let lastGen = $state(empire.generation);
	$effect(() => {
		if (empire.generation !== lastGen) {
			lastGen = empire.generation;
			archetypeGroup = deriveArchetype(empire.draft.traits);
			selectedClassKey = null;
		}
	});

	// Tags that convey no additional info on the card (archetype/polarity classification)
	const HIDDEN_CARD_TAGS = new Set([
		'positive',
		'negative',
		'special',
		'automod',
		'background',
		'interesting',
		'modularity',
		'individual',
		'organic',
		'machine',
		'synthetic',
		'cybernetic',
		'psionic',
		'lithoid'
	]);

	const SPECIES_PHENOTYPE_TAGS = new Set([
		'aquatic',
		'arthropoid',
		'avian',
		'fungoid',
		'humanoid',
		'lithoid',
		'mammalian',
		'molluscoid',
		'necroid',
		'organic',
		'plantoid',
		'reptilian',
		'species',
		'toxoid'
	]);

	const POLARITY_TAGS = new Set(['positive', 'negative']);

	// Species classes shown in the picker for the current group
	const displayedSpeciesClasses = $derived(
		data.speciesClasses.filter((sc) =>
			archetypeGroup === 'MACHINE' ? sc.archetype === 'MACHINE' : sc.archetype !== 'MACHINE'
		)
	);

	const selectedClass = $derived(
		selectedClassKey
			? (data.speciesClasses.find((sc) => sc.key === selectedClassKey) ?? null)
			: null
	);

	// Actual archetype used for trait filtering (Lithoid class overrides BIOLOGICAL group)
	const archetype = $derived(selectedClass?.archetype ?? archetypeGroup);

	const archetypeConfig = $derived(data.archetypes[archetype]);
	const maxPoints = $derived(archetypeConfig?.traitPoints ?? 2);
	const maxTraits = $derived(archetypeConfig?.maxTraits ?? 5);
	const baseTraitObj = $derived(
		archetypeConfig?.baseTrait ? (data.baseTraits[archetypeConfig.baseTrait] ?? null) : null
	);

	function selectClass(key: string) {
		if (selectedClassKey === key) {
			selectedClassKey = null;
		} else {
			selectedClassKey = key;
			const cls = data.speciesClasses.find((sc) => sc.key === key);
			archetypeGroup = cls?.archetype === 'MACHINE' ? 'MACHINE' : 'BIOLOGICAL';
		}
	}

	function selectArchetypeGroup(group: ArchetypeGroup) {
		archetypeGroup = group;
		selectedClassKey = null;
	}

	// Prune selected traits whenever available traits change
	$effect(() => {
		const valid = new Set(visibleTraits.map((t) => t.key));
		const pruned = [...selected].filter((k) => valid.has(k));
		if (pruned.length !== selected.size) empire.setTraits(pruned);
	});

	// Clear tag filters when switching archetype group
	$effect(() => {
		void archetypeGroup;
		activeTags = new Set();
	});

	const visibleTraits = $derived(
		data.traits
			.filter((t) => t.archetypes.includes(archetype))
			.filter((t) => {
				if (!selectedClassKey || t.category !== 'phenotype') return true;
				return t.speciesClasses.length === 0 || t.speciesClasses.includes(selectedClassKey);
			})
			.sort((a, b) => {
				const costDiff = (b.cost ?? -Infinity) - (a.cost ?? -Infinity);
				if (costDiff !== 0) return costDiff;
				return formatKey(a.key).localeCompare(formatKey(b.key));
			})
	);

	const allTagsInView = $derived.by(() => {
		const tags = new Set<string>();
		for (const t of visibleTraits) for (const tag of t.tags) tags.add(tag);
		return [...tags].sort();
	});

	const mainFilterTags = $derived(
		allTagsInView.filter((t) => !SPECIES_PHENOTYPE_TAGS.has(t) && !POLARITY_TAGS.has(t))
	);
	const speciesFilterTags = $derived(allTagsInView.filter((t) => SPECIES_PHENOTYPE_TAGS.has(t)));
	const speciesLeadTag = $derived(speciesFilterTags.includes('species') ? 'species' : null);
	const speciesRestTags = $derived(speciesFilterTags.filter((t) => t !== 'species'));
	const polarityFilterTags = $derived(
		['positive', 'negative'].filter((t) => allTagsInView.includes(t))
	);

	function toggleTag(tag: string) {
		const next = new Set(activeTags);
		if (next.has(tag)) next.delete(tag);
		else next.add(tag);
		activeTags = next;
	}

	const filteredVisibleTraits = $derived(
		activeTags.size === 0
			? visibleTraits
			: visibleTraits.filter((t) => t.tags.some((tag) => activeTags.has(tag)))
	);

	const traitsByCategory = $derived.by(() => {
		const groups = new Map<string, Trait[]>();
		for (const t of filteredVisibleTraits) {
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
						groupMap.set(gKey, {
							key: gKey,
							labels,
							colors: labels.map(speciesClassColor),
							traits: []
						});
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

	// Negative-cost traits give back points, expanding the effective budget.
	const negativeBonus = $derived(
		selectedTraits.reduce((sum, t) => sum + Math.min(0, t.cost ?? 0), 0)
	);
	const positiveSpend = $derived(
		selectedTraits.reduce((sum, t) => sum + Math.max(0, t.cost ?? 0), 0)
	);
	const effectiveBudget = $derived(maxPoints - negativeBonus); // maxPoints + |negativeBonus|

	// Maps blocked trait key → the first selected trait causing the conflict
	const blockedByOpposite = $derived.by(() => {
		const blocked = new Map<string, string>();
		for (const key of selected) {
			const trait = data.traits.find((t) => t.key === key);
			if (trait) for (const opp of trait.opposites) if (!blocked.has(opp)) blocked.set(opp, key);
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
		empire.setTraits([...next]);
	}

	function formatKey(key: string): string {
		return key
			.replace(/^trait_/, '')
			.split('_')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}

	function formatTag(tag: string): string {
		return tag
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

	// Value formatting (fractions vs percentages) lives in one place: $lib/civics.
	const formatModifier = formatModifierValue;
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	{#snippet traitCard(trait: Trait, borderColor: string, isBase: boolean = false)}
		{@const isSelected = !isBase && selected.has(trait.key)}
		{@const isConflicted = !isBase && !isSelected && blockedByOpposite.has(trait.key)}
		{@const isBlockable = !isBase && !isSelected && !canToggle(trait)}
		{@const debug = isBase || data.debugDisableSelection}
		{@const tooltip = isConflicted
			? `Conflicts with ${formatKey(blockedByOpposite.get(trait.key)!)}`
			: isBlockable
				? traitCount >= maxTraits
					? 'No trait picks remaining'
					: 'Not enough points remaining'
				: undefined}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<svelte:element
			this={debug ? 'div' : 'button'}
			class="relative card text-left transition-all
				{isBase
				? 'cursor-default preset-filled opacity-70'
				: isSelected && !debug
					? 'preset-filled-primary-500'
					: isConflicted && !debug
						? 'cursor-not-allowed preset-filled opacity-50 ring-2 ring-red-500/80 ring-inset'
						: isBlockable && !debug
							? 'cursor-not-allowed preset-filled opacity-35'
							: debug
								? 'cursor-text preset-filled select-text'
								: 'cursor-pointer preset-filled card-hover'}
				p-3"
			style="border-top: 2px solid {borderColor}"
			title={isBase ? 'Always included — not counted toward picks or points' : tooltip}
			onclick={debug ? undefined : () => toggle(trait)}
			disabled={!debug && isBlockable}
		>
			{#if isBase}
				<span class="absolute top-1.5 left-1.5 font-mono text-[10px] leading-tight text-amber-400">
					Base
				</span>
			{:else}
				<span
					class="absolute top-1.5 left-1.5 font-mono text-[10px] leading-tight {costClass(
						trait.cost,
						isSelected
					)}"
				>
					{costLabel(trait.cost)}
				</span>
			{/if}
			{#if trait.required_dlc}
				<span
					class="absolute top-1.5 right-1.5 rounded bg-secondary-500 px-1 text-[10px] leading-tight text-secondary-contrast-500"
				>
					{trait.required_dlc}
				</span>
			{/if}
			<div class="flex flex-col gap-1 pt-4">
				<span
					class="text-sm leading-tight font-medium {!isSelected &&
					trait.cost !== null &&
					trait.cost < 0
						? 'text-red-400'
						: ''}">{formatKey(trait.key)}</span
				>
				{#if trait.modifiers.length > 0}
					<ul class="space-y-0.5">
						{#each trait.modifiers as mod (mod.key)}
							<li class="flex items-baseline justify-between gap-1 text-[10px]">
								<span class="leading-tight opacity-60">{mod.label ?? mod.key}</span>
								<span
									class="shrink-0 font-mono {mod.value > 0 === mod.positiveIsGood
										? 'text-emerald-400'
										: 'text-red-400'}">{formatModifier(mod)}</span
								>
							</li>
						{/each}
					</ul>
				{/if}
				{#if trait.speciesClasses.length > 0}
					<div class="flex flex-wrap items-center gap-1">
						{#each trait.speciesClasses as cls (cls)}
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
				{#each [trait.tags.filter((t) => !HIDDEN_CARD_TAGS.has(t))] as visibleTags, i (i)}
					{#if visibleTags.length > 0}
						<div class="mt-0.5 flex flex-wrap items-center gap-0.5">
							{#each visibleTags as tag (tag)}
								<span
									class="rounded px-1 text-[9px] leading-tight
										{activeTags.has(tag)
										? 'bg-primary-500/20 text-primary-300 opacity-90'
										: 'bg-surface-500/20 opacity-50'}"
								>
									{formatTag(tag)}
								</span>
							{/each}
						</div>
					{/if}
				{/each}
			</div>
		</svelte:element>
	{/snippet}

	<div
		class="space-y-6 [@media(min-height:700px)]:sticky [@media(min-height:700px)]:top-0 [@media(min-height:700px)]:z-10 [@media(min-height:700px)]:pb-2"
		style="background-color: var(--color-surface-50-950)"
	>
		<h1 class="text-2xl font-bold">Species Builder</h1>

		<!-- Budget + selection summary -->
		<div class="card preset-filled p-4">
			<!-- Points & picks dots -->
			<div class="mb-2 flex items-baseline justify-between text-sm">
				<span>
					<strong
						class={pointsRemaining < 0
							? 'text-red-400'
							: pointsRemaining === 0
								? 'text-amber-400'
								: ''}
					>
						{pointsRemaining}
					</strong>
					/ {maxPoints} trait points remaining
				</span>
				{#if traitCount > 0}
					<button class="btn preset-filled text-xs" onclick={() => empire.setTraits([])}>
						Clear all
					</button>
				{/if}
				<span>
					<strong>{maxTraits - traitCount}</strong> / {maxTraits} trait picks remaining
				</span>
			</div>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					{#each Array.from({ length: effectiveBudget }) as _, i (i)}
						{@const taken = i < Math.min(positiveSpend, effectiveBudget)}
						<span
							class="h-4 w-4 rounded-full border-2 transition-all
						{taken
								? pointsRemaining < 0
									? 'border-red-500'
									: 'border-amber-400'
								: pointsRemaining < 0
									? 'border-red-500 bg-red-500'
									: 'border-amber-400 bg-amber-400'}"
						></span>
					{/each}
				</div>
				<div class="flex items-center gap-2">
					{#each Array.from({ length: maxTraits }) as _, i (i)}
						<span
							class="h-4 w-4 rounded-full border-2 transition-all
						{i < traitCount ? 'border-primary-500' : 'border-primary-500 bg-primary-500'}"
						></span>
					{/each}
				</div>
			</div>

			{#if baseTraitObj || traitCount > 0}
				<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#if baseTraitObj}
						{@render traitCard(baseTraitObj, '#d97706', true)}
					{/if}
					{#each selectedTraits as trait (trait.key)}
						{@render traitCard(trait, categoryColorMap.get(trait.category) ?? '#888')}
					{/each}
				</div>
			{:else}
				<p class="mt-3 text-sm opacity-50">No traits selected. Pick up to {maxTraits} below.</p>
			{/if}
		</div>
	</div>
	<!-- end sticky header -->

	<!-- Species selector -->
	<div class="space-y-2">
		<div class="flex flex-wrap gap-2">
			{#each ARCHETYPE_GROUPS as group (group.key)}
				<button
					class="btn {archetypeGroup === group.key ? 'preset-filled-primary-500' : 'preset-filled'}"
					onclick={() => selectArchetypeGroup(group.key)}
				>
					{group.label}
				</button>
			{/each}
		</div>
		{#if displayedSpeciesClasses.length > 0}
			<div class="flex flex-wrap gap-1.5">
				{#each displayedSpeciesClasses as sc (sc.key)}
					<button
						class="btn text-sm {selectedClassKey === sc.key
							? 'preset-filled-primary-500'
							: 'preset-filled'}"
						onclick={() => selectClass(sc.key)}
					>
						{sc.label}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Tag filter -->
	{#if allTagsInView.length > 0}
		{#snippet tagBtn(tag: string)}
			<button
				class="btn px-2 py-0.5 text-xs leading-tight {activeTags.has(tag)
					? 'preset-filled-primary-500'
					: 'preset-filled'}"
				onclick={() => toggleTag(tag)}
			>
				{formatTag(tag)}
			</button>
		{/snippet}
		<div class="space-y-1">
			{#if mainFilterTags.length > 0}
				<div class="flex flex-wrap items-center gap-1">
					<span class="w-16 shrink-0 text-xs opacity-40">Tags</span>
					{#each mainFilterTags as tag (tag)}{@render tagBtn(tag)}{/each}
				</div>
			{/if}
			{#if speciesFilterTags.length > 0}
				<div class="flex flex-wrap items-center gap-1">
					<span class="w-16 shrink-0 text-xs opacity-40">Species</span>
					{#if speciesLeadTag}{@render tagBtn(speciesLeadTag)}{/if}
					{#if speciesLeadTag && speciesRestTags.length > 0}
						<span class="text-xs opacity-20 select-none">|</span>
					{/if}
					{#each speciesRestTags as tag (tag)}{@render tagBtn(tag)}{/each}
				</div>
			{/if}
			{#if polarityFilterTags.length > 0}
				<div class="flex flex-wrap items-center gap-1">
					<span class="w-16 shrink-0 text-xs opacity-40">Polarity</span>
					{#each polarityFilterTags as tag (tag)}{@render tagBtn(tag)}{/each}
				</div>
			{/if}
			{#if activeTags.size > 0}
				<div class="flex items-center gap-1">
					<span class="w-16 shrink-0"></span>
					<button
						class="btn preset-filled text-xs opacity-60"
						onclick={() => (activeTags = new Set())}
					>
						Clear all
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Category legend -->
	{#if traitsByCategory.size > 0}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs opacity-70">
			{#each data.traitCategories.filter((c) => traitsByCategory.has(c.key)) as cat (cat.key)}
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
	{#each data.traitCategories as cat (cat.key)}
		{#if traitsByCategory.has(cat.key)}
			{@const color = cat.colorHex ?? '#888'}
			<section>
				<div class="mb-3 flex items-center justify-between">
					<h2 class="pl-3 text-lg font-semibold" style="border-left: 3px solid {color}">
						{cat.label}
					</h2>
					{#if cat.key === 'phenotype' && !selectedClassKey}
						<div class="flex gap-1">
							<button
								class="btn text-xs {!groupPhenotype
									? 'preset-filled-primary-500'
									: 'preset-filled'}"
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

				{#if cat.key === 'phenotype' && groupPhenotype && !selectedClassKey}
					{#if phenotypeGroups.unrestricted.length > 0}
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{#each phenotypeGroups.unrestricted as trait (trait.key)}
								{@render traitCard(trait, color)}
							{/each}
						</div>
					{/if}
					{#each phenotypeGroups.groups as group (group.label)}
						<div class="mt-4">
							<h3
								class="mb-2 pl-2 text-sm font-medium opacity-60"
								style="border-left: 2px solid {group.color}"
							>
								{group.label}
							</h3>
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
								{#each group.traits as trait (trait.key)}
									{@render traitCard(trait, color)}
								{/each}
							</div>
						</div>
					{/each}
				{:else if cat.key === 'phenotype'}
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{#each traitsByCategory.get(cat.key)! as trait (trait.key)}
							{@render traitCard(trait, color)}
						{/each}
					</div>
				{:else}
					{@const subGroups = traitSubGroups.get(cat.key)!}
					{#if subGroups.unrestricted.length > 0}
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{#each subGroups.unrestricted as trait (trait.key)}
								{@render traitCard(trait, color)}
							{/each}
						</div>
					{/if}
					{#each subGroups.groups as group (group.key)}
						<div class="mt-4">
							<h3
								class="mb-2 pl-2 text-sm font-medium opacity-60"
								style="border-left: 2px solid {group.colors[0]}"
							>
								{group.labels.join(' · ')}
							</h3>
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
								{#each group.traits as trait (trait.key)}
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
