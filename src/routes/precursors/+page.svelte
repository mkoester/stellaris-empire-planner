<script lang="ts">
	import type { PageData } from './$types';
	import type { Precursor, PrecursorPlanet } from '$lib/server/db';
	import {
		EMPIRE_TYPES,
		type EmpireType,
		conditionApplies,
		variantApplies,
		conditionLabel,
		formatValue,
		valueColor,
		modLabel,
		variantLabel,
		shownPlanets,
		isRelevant,
		isTerraformable,
		depositChips,
		megaLabel,
		dlcBadge,
		groupByDlc
	} from '$lib/precursors';

	let { data }: { data: PageData } = $props();

	const precursors = $derived(data.precursors as Precursor[]);

	// ── Availability selection (mirrors choosing precursors at galaxy setup) ──
	// Default: all available. Reading initial `data` here is intentional (one-shot default).
	// svelte-ignore state_referenced_locally
	let enabled = $state(new Set((data.precursors as Precursor[]).map((p) => p.key)));
	const enabledCount = $derived(enabled.size);

	function toggle(key: string) {
		const next = new Set(enabled);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		enabled = next;
	}
	function enableAll() {
		enabled = new Set(precursors.map((p) => p.key));
	}
	function disableAll() {
		enabled = new Set();
	}

	// ── Empire-type filter ───────────────────────────────────────────────────
	// 'planner' is a placeholder default (will eventually read the empire from the
	// Species Builder) and applies no highlighting. See $lib/precursors for the
	// applies-logic (variantApplies / conditionApplies).
	let empireFilter = $state<'planner' | EmpireType>('planner');
	const activeType = $derived<EmpireType | null>(empireFilter === 'planner' ? null : empireFilter);

	// ── Group by DLC (base first), precursors sorted alphabetically within each ──
	const groups = $derived(groupByDlc(precursors));
</script>

{#snippet planetRow(planet: PrecursorPlanet)}
	{@const chips = depositChips(planet.deposits)}
	<li class="text-xs">
		<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
			{#if planet.isHomeworld}<span class="text-amber-300/80" title="Precursor homeworld">★</span
				>{/if}
			<span class="opacity-80">{planet.planetClassLabel ?? planet.planetClass}</span>
			{#if planet.size != null}<span class="opacity-40">size {planet.size}</span>{/if}
			{#if isTerraformable(planet)}
				<span
					class="rounded bg-sky-500/10 px-1 text-[10px] text-sky-300/80"
					title="Terraformable into a colony (e.g. with the right ascension perk)"
					>terraformable</span
				>
			{/if}
			{#each chips.resources as r}
				<span class="rounded bg-emerald-500/10 px-1 text-[10px] text-emerald-300/90">{r}</span>
			{/each}
			{#each chips.others as o}
				<span class="rounded bg-surface-500/15 px-1 text-[10px] opacity-50">{o}</span>
			{/each}
			{#each chips.blockers as b}
				<span class="rounded bg-surface-500/20 px-1 text-[10px] opacity-50" title="Planet blocker">
					{b.name}{#if b.count > 1}
						×{b.count}{/if}
				</span>
			{/each}
		</div>
		{#each planet.modifiers as mod}
			<div class="ml-4 flex items-baseline justify-between gap-3 opacity-60">
				<span>{modLabel(mod)}</span>
				<span class="font-mono {valueColor(mod)}">{formatValue(mod)}</span>
			</div>
		{/each}
	</li>
{/snippet}

<main class="mx-auto max-w-7xl space-y-8 p-4">
	<div class="flex items-baseline gap-4">
		<h1 class="text-2xl font-bold">Precursors</h1>
		<nav class="flex gap-3 text-sm opacity-50">
			<a href="/ethics" class="transition-opacity hover:opacity-100">← Ethics</a>
		</nav>
	</div>

	<p class="max-w-3xl text-sm opacity-60">
		The ancient civilisations whose archaeology chains you can uncover. Each grants a
		<strong>permanent empire effect</strong>, usually a <strong>relic</strong>, sometimes a
		<strong>building</strong>, and a unique <strong>home system</strong>. Toggle which ones are
		available in your game.
	</p>

	<!-- Availability toolbar -->
	<div class="flex flex-wrap items-center gap-3">
		<span class="text-sm opacity-60">
			<strong>{enabledCount}</strong> / {precursors.length} available
		</span>
		<button class="btn preset-filled text-xs" onclick={enableAll}>Enable all</button>
		<button class="btn preset-filled text-xs" onclick={disableAll}>Disable all</button>
	</div>

	<!-- Empire-type filter: highlights the effects that apply to the chosen type -->
	<div class="flex flex-wrap items-center gap-2">
		<span class="text-sm opacity-60">Highlight for empire type:</span>
		<button
			class="btn text-xs {empireFilter === 'planner'
				? 'preset-filled-primary-500'
				: 'preset-filled card-hover'}"
			title="Will use your empire from the Species Builder (coming soon)"
			onclick={() => (empireFilter = 'planner')}
		>
			From planner <span class="opacity-50">(soon)</span>
		</button>
		{#each EMPIRE_TYPES as et}
			<button
				class="btn text-xs {empireFilter === et.key
					? 'preset-filled-primary-500'
					: 'preset-filled card-hover'}"
				onclick={() => (empireFilter = et.key)}
			>
				{et.label}
			</button>
		{/each}
	</div>

	{#each groups as group}
		<section class="space-y-3">
			<h2 class="flex items-center gap-2 text-lg font-semibold">
				{group.label}
				{#if group.dlc}
					<span class="rounded border px-1.5 py-0.5 text-[10px] font-normal {dlcBadge(group.dlc)}"
						>DLC</span
					>
				{/if}
			</h2>

			<div class="grid gap-4 lg:grid-cols-2">
				{#each group.items as p (p.key)}
					{@const on = enabled.has(p.key)}
					<article
						class="rounded-lg border p-4 transition-all {on
							? 'border-primary-500/40 bg-surface-500/5'
							: 'border-surface-400-500/20 opacity-45'}"
					>
						<!-- Card header -->
						<header class="mb-3 flex items-start justify-between gap-3">
							<div>
								<h3 class="text-lg font-semibold">{p.name ?? p.key}</h3>
								<div class="mt-0.5 flex items-center gap-2 text-[11px] opacity-50">
									{#if p.relic}<span>Relic</span>{/if}
									{#if p.buildings.length}<span>· Building</span>{/if}
									{#if p.numDigsites}<span>· {p.numDigsites} dig sites</span>{/if}
									<span>· {p.systems.length} system{p.systems.length === 1 ? '' : 's'}</span>
								</div>
							</div>
							<label class="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
								<input
									type="checkbox"
									class="checkbox"
									checked={on}
									onchange={() => toggle(p.key)}
								/>
								<span class="opacity-60">{on ? 'Available' : 'Off'}</span>
							</label>
						</header>

						<!-- Permanent empire effect (reward modifiers) -->
						{#if p.rewards.length}
							<div class="mb-3">
								<h4 class="mb-1 text-xs font-medium tracking-wide uppercase opacity-40">
									Permanent effect
								</h4>
								{#if p.rewards.length > 1}
									<p class="mb-1.5 text-[11px] italic opacity-40">
										Only one applies, by empire type / choice:
									</p>
								{/if}
								<div class="space-y-2">
									{#each p.rewards as reward}
										{@const applies = activeType
											? variantApplies(reward.variant, activeType)
											: null}
										<div class={applies === false ? 'opacity-40' : ''}>
											{#if p.rewards.length > 1}
												<div
													class="text-[11px] font-medium {applies === true
														? 'text-primary-400'
														: 'opacity-60'}"
												>
													{variantLabel(reward)}
													{#if reward.name}<span class="font-normal opacity-40"
															>· {reward.name}</span
														>{/if}
													{#if applies === true}<span class="opacity-70"> ✓</span>{/if}
												</div>
											{/if}
											<ul class="space-y-0.5">
												{#each reward.modifiers as mod}
													<li class="flex items-baseline justify-between gap-3 text-sm">
														<span class="opacity-70">{modLabel(mod)}</span>
														<span class="shrink-0 font-mono {valueColor(mod)}"
															>{formatValue(mod)}</span
														>
													</li>
												{/each}
											</ul>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Relic -->
						{#if p.relic}
							<div class="mb-3">
								<h4 class="mb-1 text-xs font-medium tracking-wide uppercase opacity-40">
									Relic — <span class="text-amber-300/80 normal-case"
										>{p.relic.name ?? p.relic.relicKey}</span
									>
								</h4>
								{#if p.relic.passives.length}
									<ul class="space-y-0.5">
										{#each p.relic.passives as passive}
											{@const cond = conditionLabel(passive.condition)}
											{@const applies = activeType
												? conditionApplies(passive.condition, activeType)
												: null}
											<li
												class="flex items-baseline justify-between gap-3 text-sm {applies === false
													? 'opacity-30'
													: ''}"
											>
												<span class="opacity-70">
													{modLabel(passive)}
													{#if cond}<span
															class="text-[10px] {applies === true
																? 'text-primary-400'
																: 'opacity-40'}">({cond})</span
														>{/if}
												</span>
												<span class="shrink-0 font-mono {valueColor(passive)}"
													>{formatValue(passive)}</span
												>
											</li>
										{/each}
									</ul>
								{/if}
								{#if p.relic.activeEffect}
									<p class="mt-1.5 text-xs opacity-55">
										<span class="opacity-40">Active:</span>
										{p.relic.activeEffect}
									</p>
								{/if}
							</div>
						{/if}

						<!-- Buildings -->
						{#if p.buildings.length}
							<div class="mb-3">
								<h4 class="mb-1 text-xs font-medium tracking-wide uppercase opacity-40">
									Building
								</h4>
								<ul class="space-y-0.5 text-sm">
									{#each p.buildings as b}
										<li class="opacity-70">
											{b.name ?? b.buildingKey}
											{#if b.scope}<span class="text-[10px] opacity-40"> ({b.scope})</span>{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						<!-- Home system(s): relevant bodies shown, rest behind "show more" -->
						{#if p.systems.length}
							<div class="mt-3">
								<h4 class="mb-1 text-xs font-medium tracking-wide uppercase opacity-40">
									Home system{p.systems.length === 1 ? '' : 's'}
								</h4>
								<div class="space-y-2">
									{#each p.systems as sys}
										{@const shown = shownPlanets(sys.planets)}
										{@const relevant = shown.filter(isRelevant)}
										{@const rest = shown.filter((pl) => !isRelevant(pl))}
										<div class="border-surface-400-500/20 rounded border p-2">
											<div class="mb-1 flex flex-wrap items-baseline gap-2">
												<span class="text-sm font-medium">{sys.name ?? sys.initializer}</span>
												{#each sys.megastructures as ms}
													<span
														class="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300"
													>
														{megaLabel(ms)}
													</span>
												{/each}
											</div>
											{#if relevant.length}
												<ul class="space-y-1">
													{#each relevant as planet}{@render planetRow(planet)}{/each}
												</ul>
											{:else if sys.megastructures.length === 0}
												<p class="text-xs italic opacity-40">
													No habitable worlds or notable deposits.
												</p>
											{/if}
											{#if rest.length}
												<details class="group mt-1.5">
													<summary
														class="cursor-pointer list-none text-[11px] opacity-40 hover:opacity-70"
													>
														<span class="inline-block transition-transform group-open:rotate-90"
															>▸</span
														>
														{rest.length} more {rest.length === 1 ? 'body' : 'bodies'}
													</summary>
													<ul class="mt-1 space-y-1">
														{#each rest as planet}{@render planetRow(planet)}{/each}
													</ul>
												</details>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</article>
				{/each}
			</div>
		</section>
	{/each}
</main>
