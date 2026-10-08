<script lang="ts">
	import type { PageData } from './$types';
	import type { AscensionPerk } from '$lib/server/db';
	import EmpireProfileBar from '$lib/EmpireProfileBar.svelte';
	import RequirementChips from '$lib/RequirementChips.svelte';
	import EffectList from '$lib/EffectList.svelte';
	import Tip from '$lib/Tip.svelte';
	import { settings } from '$lib/settings.svelte';
	import { dlcBadge } from '$lib/precursors';
	import {
		ANY_PROFILE,
		evaluate,
		isActive,
		perkTier,
		requirementLines,
		triggerText,
		type RequirementLine
	} from '$lib/triggers';
	import { effective, matches, searchText, treeLinks } from '$lib/traditions';

	let { data }: { data: PageData } = $props();

	let query = $state('');

	const names = $derived.by(() => {
		const out: Record<string, string> = { ...(data.names ?? {}) };
		for (const t of data.trees)
			for (const x of [t.adopt, ...t.traditions, t.finish]) if (x.name) out[x.key] = x.name;
		for (const p of data.perks) if (p.name) out[p.key] = p.name;
		return out;
	});
	const links = $derived(treeLinks(data.trees, data.perks));
	// perk key → names of the trees it unlocks
	const unlocksTrees = $derived.by(() => {
		const out: Record<string, string[]> = {};
		for (const t of data.trees)
			for (const k of links.unlockedBy[t.key] ?? []) (out[k] ??= []).push(t.name ?? t.key);
		return out;
	});

	const profile = $derived(settings.empireProfile);
	const filtering = $derived(isActive(profile));

	// Requirement chips of a perk, with "can't be combined with perk X" split off.
	function requirements(p: AscensionPerk): {
		needs: RequirementLine[];
		excludes: RequirementLine[];
	} {
		const lines = [
			...requirementLines(p.potential, names, profile, ['host_has_dlc']),
			...requirementLines(p.possible, names, profile, ['num_ascension_perks'])
		];
		const seen = new Set<string>();
		const unique = lines.filter((l) => {
			const id = `${l.type}:${l.text}`;
			if (seen.has(id) || l.value === p.key) return false; // "not already taken" is noise
			seen.add(id);
			return true;
		});
		const isExclusive = (l: RequirementLine) =>
			l.type === 'excludes' && l.leaf === 'has_ascension_perk';
		return { needs: unique.filter((l) => !isExclusive(l)), excludes: unique.filter(isExclusive) };
	}

	const view = $derived(
		data.perks
			// DLC-superseded copies (e.g. Galactic Wonders without Utopia) never show.
			.filter((p) => evaluate(p.potential, ANY_PROFILE) !== false)
			.map((p) => {
				const avail =
					evaluate(p.potential, profile) === false || evaluate(p.possible, profile) === false
						? false
						: null;
				const tier = perkTier(p.possible, profile);
				const visible =
					(!filtering || (avail !== false && tier !== null) || settings.showUnavailable) &&
					(!query || matches(searchText(p), query));
				return { perk: p, tier, avail: avail === false || tier === null ? false : null, visible };
			})
	);

	const TIER_LABEL = [
		'Tier 0 — from the start',
		'Tier 1 — after 1 perk',
		'Tier 2 — after 2 perks',
		'Tier 3 — after 3 perks'
	];
	const groups = $derived.by(() => {
		const shown = view.filter((v) => v.visible);
		const out = [
			{
				label: 'Ascension paths',
				note: 'Only one per empire; each needs a free tradition slot and opens its ascension tree.',
				items: shown.filter((v) => v.perk.isPath)
			}
		];
		const tiers = [...new Set(shown.filter((v) => !v.perk.isPath).map((v) => v.tier))].sort(
			(a, b) => (a ?? 99) - (b ?? 99)
		);
		for (const t of tiers)
			out.push({
				label: t === null ? 'Not available to this empire' : (TIER_LABEL[t] ?? `Tier ${t}`),
				note: '',
				items: shown.filter((v) => !v.perk.isPath && v.tier === t)
			});
		return out.filter((g) => g.items.length);
	});
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Ascension Perks</h1>
		<p class="max-w-3xl text-sm opacity-60">
			Grouped by tier: how many perks you need before taking one. Tiers, variants and requirement
			colours follow the empire type below (green = met, red = not met, grey = depends on things the
			planner can't know). Every finished tradition tree adds a slot, up to
			{data.defines.ASCENSION_PERKS_SLOTS ?? 8}. Assumes all DLC.
		</p>
	</div>

	<EmpireProfileBar
		bind:query
		archetypeOf={data.archetypeOf}
		nomadicOrigins={data.nomadicOrigins}
	/>

	{#each groups as group (group.label)}
		<section class="space-y-3">
			<div>
				<h2 class="text-lg font-semibold">
					{group.label} <span class="text-sm font-normal opacity-50">({group.items.length})</span>
				</h2>
				{#if group.note}<p class="text-xs opacity-60">{group.note}</p>{/if}
			</div>
			<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{#each group.items as v (v.perk.key)}
					{@const p = v.perk}
					{@const e = effective(p, profile)}
					{@const req = requirements(p)}
					<article
						class="border-surface-400-500/30 flex flex-col gap-2 rounded-lg border p-3 {filtering &&
						v.avail === false
							? 'opacity-40'
							: ''}"
					>
						<header class="flex flex-wrap items-center gap-1.5">
							<h3 class="font-semibold">{e.name ?? p.key}</h3>
							{#if p.requiredDlc}
								<Tip
									text={p.requiredDlc}
									class="rounded border px-1 text-[10px] {dlcBadge(p.requiredDlc)}">DLC</Tip
								>
							{/if}
							{#if p.isPath && v.tier !== null}
								<span class="rounded bg-surface-500/20 px-1.5 text-[10px]"
									>needs {v.tier} perks</span
								>
							{/if}
						</header>

						<EffectList effect={e} {names} />

						{#if unlocksTrees[p.key]?.length}
							<p class="text-[11px] text-violet-300">
								Opens tradition tree: {unlocksTrees[p.key].join(', ')}
							</p>
						{/if}
						<RequirementChips label="Needs" lines={req.needs} />
						<RequirementChips label="Not with" lines={req.excludes} />

						{#if e.otherSwaps.length}
							<details class="text-[11px]">
								<summary class="cursor-pointer opacity-60">
									{e.otherSwaps.length} other variant{e.otherSwaps.length === 1 ? '' : 's'}
								</summary>
								<ul class="mt-1 space-y-0.5">
									{#each e.otherSwaps as s (s.id)}
										<li>
											<span class="font-semibold">{s.name}</span>
											<span class="opacity-60"
												>— if {s.trigger ? triggerText(s.trigger, names) : 'always'}</span
											>
										</li>
									{/each}
								</ul>
							</details>
						{/if}

						{#if e.description}
							<p class="mt-auto text-xs leading-relaxed italic opacity-50">{e.description}</p>
						{/if}
					</article>
				{/each}
			</div>
		</section>
	{/each}

	{#if groups.length === 0}
		<p class="text-sm opacity-60">No perk matches.</p>
	{/if}
</main>
