<script lang="ts">
	import type { PageData } from './$types';
	import type { PortraitClassInfo, PortraitInfo } from '$lib/server/db';
	import Tip from '$lib/Tip.svelte';

	let { data }: { data: PageData } = $props();
	const portraits = $derived(data.portraits as PortraitInfo[]);
	const traitInfo = $derived(data.traitInfo);

	let query = $state('');
	let onlyBonus = $state(false);

	function formatKey(key: string): string {
		return key
			.replace(/^trait_/, '')
			.split('_')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}

	// The wiki names portrait image files by phenotype + number (e.g. "Humanoid hp 16.png",
	// "Aquatic 07.png"), NOT by in-game id, and the older phenotypes were re-numbered into
	// normal/slender/massive variants — so there's no stable per-image deep link. Build a wiki
	// search from the portrait's class name + the id's distinctive tokens (id minus its leading
	// phenotype prefix), which lands on the right phenotype's files and never 404s.
	// A few class display names differ from the wiki's phenotype name (the game renamed
	// Infernal → "Thermophile" in loc, but the wiki files are still "Infernal NN.png").
	const WIKI_CLASS_NAME: Record<string, string> = { INF: 'Infernal' };
	const wikiUrl = (p: PortraitInfo) => {
		const c = p.classes[0];
		const cls = (c && WIKI_CLASS_NAME[c.key]) || c?.label || '';
		const tokens = p.id
			.replace(/^[a-z]+/, '')
			.replace(/_/g, ' ')
			.trim();
		const term = `${cls} ${tokens}`.trim();
		return `https://stellaris.paradoxwikis.com/index.php?search=${encodeURIComponent(term)}`;
	};

	const isNegative = (key: string) => traitInfo[key]?.negative ?? false;
	// Positive traits first (alphabetical), then negative (drawback) traits (alphabetical).
	const sortTraits = (keys: string[]) =>
		[...keys].sort(
			(a, b) =>
				Number(isNegative(a)) - Number(isNegative(b)) || formatKey(a).localeCompare(formatKey(b))
		);

	// Phenotypes with a dedicated wiki Species/<name> page; others (Mechanical, Mindwarden) have none.
	const SPECIES_PAGES = new Set([
		'Humanoid',
		'Mammalian',
		'Reptilian',
		'Avian',
		'Arthropoid',
		'Molluscoid',
		'Fungoid',
		'Plantoid',
		'Lithoid',
		'Necroid',
		'Aquatic',
		'Toxoid',
		'Thermophile',
		'Machine'
	]);
	const speciesUrl = (label: string) =>
		`https://stellaris.paradoxwikis.com/Species/${encodeURIComponent(label)}`;

	// Group portraits by their exact set of classes ("class signature"). Single-phenotype
	// groups (Mammalian, Humanoid, …) and the one multi-class group (Machine + Mechanical).
	interface PortraitGroup {
		classes: PortraitClassInfo[];
		label: string; // joined class labels, e.g. "Machine + Mechanical"
		traitKeys: string[]; // union of the classes' gated traits
		portraits: PortraitInfo[];
	}
	const groups = $derived.by<PortraitGroup[]>(() => {
		const q = query.trim().toLowerCase();
		const m = new Map<string, PortraitGroup>();
		for (const p of portraits) {
			if (q && !p.id.toLowerCase().includes(q)) continue;
			if (onlyBonus && p.bonusTraitKeys.length === 0) continue;
			const sig = p.classes.map((c) => c.key).join('+');
			let g = m.get(sig);
			if (!g) {
				const traitKeys = sortTraits([...new Set(p.classes.flatMap((c) => c.traitKeys))]);
				g = {
					classes: p.classes,
					label: p.classes.map((c) => c.label).join(' + '),
					traitKeys,
					portraits: []
				};
				m.set(sig, g);
			}
			g.portraits.push(p);
		}
		// Single-class groups first (alphabetical), then multi-class.
		return [...m.values()].sort(
			(a, b) => a.classes.length - b.classes.length || a.label.localeCompare(b.label)
		);
	});

	const totalShown = $derived(groups.reduce((n, g) => n + g.portraits.length, 0));
	const bonusCount = $derived(portraits.filter((p) => p.bonusTraitKeys.length > 0).length);
</script>

{#snippet traitChip(key: string)}
	{@const info = traitInfo[key]}
	<Tip
		text={info?.tooltip ?? ''}
		class="rounded px-2 py-0.5 text-xs {info?.negative
			? 'bg-rose-500/15 text-rose-300/90'
			: 'bg-emerald-500/15 text-emerald-300/90'}"
	>
		{formatKey(key)}
	</Tip>
{/snippet}

<main class="mx-auto max-w-5xl space-y-6 p-4">
	<div class="space-y-2">
		<h1 class="text-2xl font-bold">Portraits</h1>
		<p class="max-w-3xl text-sm opacity-60">
			Every portrait selectable at empire creation, grouped by the species class(es) it belongs to.
			A portrait's class gates the phenotype-specific traits you may pick — listed below per group
			(hover a trait for what it does;
			<span class="text-rose-300/90">rose</span> traits are drawbacks). On top of that, {bonusCount}
			individual portraits get <span class="text-amber-300/90">bonus</span> trait options from other
			phenotypes (the trait's <span class="font-mono text-xs">portrait_override</span>). Portrait
			ids link to a wiki search so you can look the image up.
		</p>
	</div>

	<div class="flex flex-wrap items-center gap-3">
		<input
			type="text"
			bind:value={query}
			placeholder="Filter portraits by id (e.g. mam, synth, psionic)…"
			class="input max-w-xs"
		/>
		<label class="flex items-center gap-1.5 text-sm">
			<input type="checkbox" bind:checked={onlyBonus} class="checkbox" />
			Only bonus-trait portraits
		</label>
		<span class="text-sm opacity-50">{totalShown} portrait{totalShown === 1 ? '' : 's'}</span>
	</div>

	<div class="space-y-5">
		{#each groups as g (g.label)}
			{@const bonus = g.portraits.filter((p) => p.bonusTraitKeys.length > 0)}
			{@const plain = g.portraits.filter((p) => p.bonusTraitKeys.length === 0)}
			<section class="border-surface-400-500/30 space-y-3 rounded-lg border p-4">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<h2 class="flex items-center gap-2 text-lg font-semibold">
						<span class="flex items-center gap-1">
							{#each g.classes as c, i (c.key)}
								{#if i > 0}<span class="opacity-40">+</span>{/if}
								{#if SPECIES_PAGES.has(c.label)}
									<a
										href={speciesUrl(c.label)}
										target="_blank"
										rel="external noopener noreferrer"
										class="hover:underline">{c.label}</a
									>
								{:else}
									<span>{c.label}</span>
								{/if}
							{/each}
						</span>
						{#if g.classes.length > 1}
							<span
								class="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-sky-300/90 uppercase"
								>Multi-class</span
							>
						{/if}
					</h2>
					<span class="text-xs opacity-50">{g.portraits.length} portraits</span>
				</div>

				<div>
					<div class="mb-1 text-[10px] tracking-wide uppercase opacity-40">Class traits</div>
					{#if g.traitKeys.length}
						<div class="flex flex-wrap gap-1.5">
							{#each g.traitKeys as t (t)}{@render traitChip(t)}{/each}
						</div>
					{:else}
						<span class="text-xs italic opacity-50">No class-specific traits</span>
					{/if}
				</div>

				{#if bonus.length}
					<div>
						<div class="mb-1 text-[10px] tracking-wide uppercase opacity-40">
							Portraits with bonus traits
						</div>
						<div class="space-y-1.5">
							{#each bonus as p (p.id)}
								<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
									<a
										href={wikiUrl(p)}
										target="_blank"
										rel="external noopener noreferrer"
										class="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-xs text-amber-200/90 ring-1 ring-amber-500/30 hover:underline"
										>{p.id}</a
									>
									<span class="text-[11px] opacity-40">+</span>
									{#each sortTraits(p.bonusTraitKeys) as t (t)}{@render traitChip(t)}{/each}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if plain.length}
					<div>
						<div class="mb-1 text-[10px] tracking-wide uppercase opacity-40">
							{bonus.length ? 'Other portraits' : 'Portraits'}
						</div>
						<div class="flex flex-wrap gap-1.5">
							{#each plain as p (p.id)}
								<a
									href={wikiUrl(p)}
									target="_blank"
									rel="external noopener noreferrer"
									class="rounded bg-surface-500/15 px-2 py-0.5 font-mono text-xs hover:underline"
									>{p.id}</a
								>
							{/each}
						</div>
					</div>
				{/if}
			</section>
		{/each}

		{#if groups.length === 0}
			<p class="text-sm opacity-50">
				No portraits match{query ? ` “${query}”` : ''}{onlyBonus ? ' with bonus traits' : ''}.
			</p>
		{/if}
	</div>
</main>
