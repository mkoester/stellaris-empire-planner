<script lang="ts">
	import type { PageData } from './$types';
	import type { Tradition, TraditionTree } from '$lib/server/db';
	import EmpireProfileBar from '$lib/EmpireProfileBar.svelte';
	import ProfileChips from '$lib/ProfileChips.svelte';
	import RequirementChips from '$lib/RequirementChips.svelte';
	import EffectList from '$lib/EffectList.svelte';
	import BackToTop from '$lib/BackToTop.svelte';
	import JumpLinks from '$lib/JumpLinks.svelte';
	import Tip from '$lib/Tip.svelte';
	import { settings } from '$lib/settings.svelte';
	import { formatModifierValue, modifierLabel } from '$lib/civics';
	import { dlcBadge } from '$lib/precursors';
	import {
		ANY_PROFILE,
		evaluate,
		isActive,
		requirementLines,
		triggerText,
		type EmpireProfile
	} from '$lib/triggers';
	import {
		effective,
		isAscensionTree,
		matches,
		profileAxes,
		searchText,
		traditionCost,
		treeColumns,
		treeDescription,
		treeLinks,
		unlocksFor,
		type Effective
	} from '$lib/traditions';

	let { data }: { data: PageData } = $props();

	let query = $state('');
	// Per-tree variant switch (used while no global filter is set) and selected tradition.
	let local = $state<Record<string, EmpireProfile>>({});
	let selected = $state<Record<string, string | null>>({});

	const allTraditions = (t: TraditionTree) => [t.adopt, ...t.traditions, t.finish];

	const names = $derived.by(() => {
		const out: Record<string, string> = { ...(data.names ?? {}) };
		for (const t of data.trees) for (const x of allTraditions(t)) if (x.name) out[x.key] = x.name;
		for (const p of data.perks) if (p.name) out[p.key] = p.name;
		return out;
	});
	const links = $derived(treeLinks(data.trees, data.perks));
	const texts = $derived(
		new Map(data.trees.flatMap((t) => allTraditions(t).map((x) => [x.key, searchText(x)])))
	);

	const full = $derived(settings.traditionView === 'full');
	const global = $derived(settings.empireProfile);
	const filtering = $derived(isActive(global));

	const view = $derived(
		data.trees
			// Trees an all-DLC game replaces (Genetics → BioGenesis trees) never show.
			.filter((tree) => evaluate(tree.potential, ANY_PROFILE) !== false)
			.map((tree) => {
				const profile = filtering ? global : (local[tree.key] ?? ANY_PROFILE);
				const avail = evaluate(tree.potential, profile);
				const hits = query
					? new Set(
							allTraditions(tree)
								.filter((x) => matches(texts.get(x.key)!, query))
								.map((x) => x.key)
						)
					: null;
				const nameHit = !!query && matches((tree.name ?? '').toLowerCase(), query);
				const visible =
					(!filtering || avail !== false || settings.showUnavailable) &&
					(!query || nameHit || hits!.size > 0);
				return {
					tree,
					profile,
					avail,
					hits,
					visible,
					axes: profileAxes(tree),
					columns: treeColumns(tree.traditions)
				};
			})
	);
	const groups = $derived([
		{
			id: 'tradition-trees',
			label: 'Tradition trees',
			items: view.filter((v) => v.visible && !isAscensionTree(v.tree))
		},
		{
			id: 'ascension-trees',
			label: 'Ascension trees',
			items: view.filter((v) => v.visible && isAscensionTree(v.tree))
		}
	]);
	// Section links first, then every shown tree.
	const jumpLinks = $derived(
		groups.flatMap((g) =>
			g.items.length
				? [
						{ id: g.id, label: g.label, strong: true },
						...g.items.map((v) => ({ id: v.tree.key, label: v.tree.name ?? v.tree.key }))
					]
				: []
		)
	);

	function tipText(e: Effective): string {
		const lines = e.modifiers.map(
			({ mod, state }) =>
				`${formatModifierValue(mod)} ${modifierLabel(mod)}${state === null ? ' (if …)' : ''}`
		);
		if (e.tooltip) lines.push(e.tooltip);
		return lines.join('\n') || 'No direct effects';
	}

	const perkList = (keys: string[]) => keys.map((k) => names[k] ?? k).join(', ');

	// Tradition cost calculator (defines: base, per-tradition factor, exponent, size penalty).
	let taken = $state(0);
	let empireSize = $state(100);
	let sizeEffect = $state(0); // percent reduction
	let costSetting = $state(1);
	const cost = (n: number) =>
		Math.round(traditionCost(n, empireSize, sizeEffect / 100, costSetting, data.defines));
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Tradition Trees</h1>
		<p class="max-w-3xl text-sm opacity-60">
			Every tree with its adoption bonus, the traditions in their branches (arrows show
			prerequisites), and the finisher. Names and effects switch to the variant your empire type
			gets — pick one globally below, or per tree. Assumes all DLC: trees a DLC replaces aren't
			shown, and DLC trees carry a badge. In the compact layout, click a tradition for its details; <span
				class="text-primary-400">•</span
			> marks a variant, ⇄ the number of variants other empire types get.
		</p>
	</div>

	<JumpLinks links={jumpLinks} />

	<EmpireProfileBar
		bind:query
		archetypeOf={data.archetypeOf}
		nomadicOrigins={data.nomadicOrigins}
		anyHint="No filter — each tree offers its own variant switch."
	/>

	<div class="flex items-center gap-2 text-xs">
		<span class="opacity-60">Layout:</span>
		{#each [['full', 'Full trees'], ['compact', 'Compact']] as [key, label] (key)}
			<button
				class="rounded px-2.5 py-1 {settings.traditionView === key
					? 'preset-filled-primary-500'
					: 'preset-tonal hover:preset-filled-surface-500'}"
				aria-pressed={settings.traditionView === key}
				onclick={() => settings.traditionView !== key && settings.toggleTraditionView()}
			>
				{label}
			</button>
		{/each}
	</div>

	<details class="border-surface-400-500/30 rounded-lg border p-3 text-sm">
		<summary class="cursor-pointer font-semibold">Tradition cost calculator</summary>
		<div class="mt-3 space-y-3">
			<div class="flex flex-wrap gap-4 text-xs">
				<label class="flex flex-col gap-1">
					Traditions already taken
					<input class="input w-28" type="number" min="0" max="80" bind:value={taken} />
				</label>
				<label class="flex flex-col gap-1">
					Empire size
					<input class="input w-28" type="number" min="0" bind:value={empireSize} />
				</label>
				<label class="flex flex-col gap-1">
					Empire size effect (−%)
					<input class="input w-28" type="number" min="0" max="100" bind:value={sizeEffect} />
				</label>
				<label class="flex flex-col gap-1">
					Tradition cost setting (×)
					<input
						class="input w-28"
						type="number"
						min="0.25"
						max="5"
						step="0.25"
						bind:value={costSetting}
					/>
				</label>
			</div>
			<p>
				Next tradition: <strong class="font-mono">{cost(taken).toLocaleString()}</strong> unity
			</p>
			<div class="flex flex-wrap gap-2 text-xs">
				{#each Array.from({ length: data.defines.TRADITION_CATEGORIES_MAX ?? 7 }, (_, i) => i * 7) as n (n)}
					<span class="rounded bg-surface-500/15 px-2 py-1">
						Tree {n / 7 + 1} adopt: <span class="font-mono">{cost(n).toLocaleString()}</span>
					</span>
				{/each}
			</div>
			<p class="text-xs opacity-60">
				Formula from the game defines: [{data.defines.TRADITION_COST_AMOUNTS} + ({data.defines
					.TRADITION_COST_TRADITION} × taken)^{data.defines.TRADITION_COST_TRADITION_EXP}] × [1 +
				max(size − {data.defines.EMPIRE_SIZE_BASE}, 0) × {data.defines
					.EMPIRE_SIZE_TRADITION_COST_PENALTY} × (1 − size effect)] × setting. Adoption and finisher count
				as traditions taken (wiki), so each tree is 7. At most {data.defines
					.TRADITION_CATEGORIES_MAX} trees and {data.defines.ASCENSION_PERKS_SLOTS} ascension perks.
			</p>
		</div>
	</details>

	{#each groups as group (group.label)}
		{#if group.items.length}
			<section id={group.id} class="scroll-mt-16 space-y-3">
				<h2 class="text-lg font-semibold">
					{group.label} <span class="text-sm font-normal opacity-50">({group.items.length})</span>
				</h2>
				<div class="grid gap-4 {full ? '' : 'md:grid-cols-2 xl:grid-cols-3'}">
					{#each group.items as v (v.tree.key)}
						{@const tree = v.tree}
						{@const desc = treeDescription(tree, v.profile)}
						{@const sel = allTraditions(tree).find((x) => x.key === selected[tree.key])}
						<article
							id={tree.key}
							class="border-surface-400-500/30 flex scroll-mt-16 flex-col gap-2 rounded-lg border p-3 {filtering &&
							v.avail === false
								? 'opacity-40'
								: ''}"
						>
							<header class="flex flex-wrap items-start justify-between gap-2">
								<div class="flex flex-wrap items-center gap-1.5">
									<h3 class="font-semibold">{tree.name ?? tree.key}</h3>
									{#if tree.requiredDlc}
										<Tip
											text={tree.requiredDlc}
											class="rounded border px-1 text-[10px] {dlcBadge(tree.requiredDlc)}">DLC</Tip
										>
									{/if}
									{#if links.unlockedBy[tree.key]?.length}
										<span class="rounded bg-violet-500/15 px-1.5 text-[10px] text-violet-300">
											via {perkList(links.unlockedBy[tree.key])}
										</span>
									{/if}
								</div>
								{#if !filtering && (v.axes.authorities.length || v.axes.flags.length)}
									<ProfileChips
										small
										profile={v.profile}
										authorities={v.axes.authorities}
										flags={v.axes.flags}
										onchange={(p) => (local[tree.key] = p)}
									/>
								{/if}
							</header>

							{#if desc}<p class="text-xs leading-relaxed opacity-60">{desc}</p>{/if}
							<RequirementChips
								label="Needs"
								lines={requirementLines(tree.potential, names, v.profile, ['host_has_dlc'])}
							/>
							{#if v.avail === false}
								<p class="text-xs text-red-300">Not available to this empire type.</p>
							{/if}

							{@render bonus('Adoption', tree.adopt, v.profile, tree)}

							<div
								class="grid gap-2"
								style="grid-template-columns: repeat({v.columns.length}, minmax(0, 1fr))"
							>
								{#each v.columns as rows, ci (ci)}
									<div class="flex flex-col items-stretch {full ? 'gap-1' : 'gap-0.5'}">
										{#each rows as row, ri (ri)}
											{#if ri > 0}<span class="text-center text-xs leading-none opacity-40">↓</span
												>{/if}
											<div class="flex {full ? 'items-stretch gap-2' : 'gap-1'}">
												{#each row as t (t.key)}
													{#if full}
														{@render tradBox(t, v.profile, tree, v.hits, false)}
													{:else}
														{@render node(tree, t, v.profile, v.hits)}
													{/if}
												{/each}
											</div>
										{/each}
									</div>
								{/each}
							</div>

							{@render bonus('Finisher', tree.finish, v.profile, tree)}

							{#if !full && sel && sel.role === 'normal'}
								{@render tradBox(sel, v.profile, tree, null, true)}
							{/if}
						</article>
					{/each}
				</div>
			</section>
		{/if}
	{/each}

	{#if groups.every((g) => g.items.length === 0)}
		<p class="text-sm opacity-60">No tree matches.</p>
	{/if}
</main>

<BackToTop />

{#snippet node(tree: TraditionTree, t: Tradition, profile: EmpireProfile, hits: Set<string> | null)}
	{@const e = effective(t, profile)}
	{@const isSel = selected[tree.key] === t.key}
	<Tip text={tipText(e)}>
		{#snippet trigger(a)}
			<button
				{...a}
				class="min-w-0 flex-1 rounded border px-1.5 py-1 text-left text-[11px] leading-tight {isSel
					? 'border-primary-500 bg-primary-500/10'
					: 'border-surface-400-500/30 hover:bg-surface-500/10'} {hits?.has(t.key)
					? 'ring-1 ring-amber-400'
					: ''}"
				onclick={() => (selected[tree.key] = isSel ? null : t.key)}
			>
				{e.name ?? t.key}
				{#if e.swap}
					<span class="text-primary-400" aria-label="variant">•</span>
				{:else if e.otherSwaps.length}
					<span class="opacity-40" aria-label="{e.otherSwaps.length} variants"
						>⇄{e.otherSwaps.length}</span
					>
				{/if}
			</button>
		{/snippet}
	</Tip>
{/snippet}

{#snippet bonus(label: string, t: Tradition, profile: EmpireProfile, tree: TraditionTree)}
	{@const e = effective(t, profile)}
	<div
		class="rounded bg-surface-500/10 p-2 {query &&
		texts.get(t.key) &&
		matches(texts.get(t.key)!, query)
			? 'ring-1 ring-amber-400'
			: ''}"
	>
		<div class="mb-1 flex items-baseline justify-between gap-2">
			<span class="text-[10px] font-semibold tracking-wider uppercase opacity-50">{label}</span>
			{#if e.swap?.name && e.swap.name !== t.name}
				<span class="text-[11px] text-primary-400">{e.swap.name}</span>
			{/if}
		</div>
		<EffectList effect={e} {names} unlocks={unlocksFor(t, data.edicts, data.agendas, profile)} />
		{#if t.role === 'finish' && links.unlocksPerks[tree.key]?.length}
			<p class="mt-1 text-[11px] text-violet-300">
				Unlocks ascension perk: {perkList(links.unlocksPerks[tree.key])}
			</p>
		{/if}
		{#if t.role === 'adopt'}
			<RequirementChips
				label="Adopt needs"
				lines={requirementLines(t.possible, names, profile, ['has_ascension_perk'])}
			/>
		{/if}
		{#if e.otherSwaps.length}
			{@render variants(e)}
		{/if}
	</div>
{/snippet}

{#snippet tradBox(
	t: Tradition,
	profile: EmpireProfile,
	tree: TraditionTree,
	hits: Set<string> | null,
	closable: boolean
)}
	{@const e = effective(t, profile)}
	<div
		class="min-w-0 flex-1 space-y-1.5 rounded border p-2 {closable
			? 'border-primary-500/40'
			: 'border-surface-400-500/30'} {hits?.has(t.key) ? 'ring-1 ring-amber-400' : ''}"
	>
		<div class="flex items-start justify-between gap-2">
			<div>
				<span class="text-sm font-semibold">{e.name}</span>
				{#if e.swap && e.name !== t.name}
					<span class="text-[11px] opacity-50">· variant of {t.name}</span>
				{/if}
			</div>
			{#if closable}
				<button
					class="text-xs opacity-50 hover:opacity-100"
					aria-label="Close"
					onclick={() => (selected[tree.key] = null)}>✕</button
				>
			{/if}
		</div>
		<EffectList effect={e} {names} unlocks={unlocksFor(t, data.edicts, data.agendas, profile)} />
		{#if closable && t.requires.length}
			<p class="text-[11px] opacity-70">
				Requires: {t.requires.map((r) => names[r] ?? r).join(' or ')}
			</p>
		{/if}
		<RequirementChips lines={requirementLines(t.possible, names, profile, ['has_tradition'])} />
		{#if e.otherSwaps.length}{@render variants(e)}{/if}
		{#if e.description}<p class="text-xs leading-relaxed italic opacity-50">{e.description}</p>{/if}
	</div>
{/snippet}

{#snippet variants(e: Effective)}
	<details class="mt-1 text-[11px]">
		<summary class="cursor-pointer opacity-60">
			{e.otherSwaps.length} other variant{e.otherSwaps.length === 1 ? '' : 's'}
		</summary>
		<ul class="mt-1 space-y-0.5">
			{#each e.otherSwaps as s (s.id)}
				<li>
					<span class="font-semibold">{s.name}</span>
					<span class="opacity-60">— if {s.trigger ? triggerText(s.trigger, names) : 'always'}</span
					>
				</li>
			{/each}
		</ul>
	</details>
{/snippet}
