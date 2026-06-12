<script lang="ts">
	import type { PageData } from './$types';
	import type { Precursor, PrecursorPlanet, PrecursorBuilding } from '$lib/server/db';
	import {
		EMPIRE_TYPES,
		type EmpireType,
		conditionApplies,
		conditionLabel,
		typesLabel,
		mergeRelicPassives,
		mergeRewardModifiers,
		rewardQualifier,
		homeworldRewardLabel,
		buildingResourceLabel,
		buildingJobLabel,
		buildingLimitLabel,
		buildingConditionLabel,
		buildingScopeLabel,
		habitableWorldCount,
		terraformableWorldCount,
		moltenWorldCount,
		isHabitable,
		hasMoltenWorld,
		arcFurnaceDepositCount,
		countLabel,
		formatValue,
		valueColor,
		modLabel,
		shownPlanets,
		isRelevant,
		isTerraformable,
		depositChips,
		megaLabel,
		relicResourceLabel,
		groupActiveModifiers,
		cooldownLabel,
		dlcBadge,
		groupByDlc
	} from '$lib/precursors';

	let { data }: { data: PageData } = $props();

	const precursors = $derived(data.precursors as Precursor[]);

	// ── Empire-type filter ───────────────────────────────────────────────────
	// Highlights the effects that apply to the chosen empire type. 'planner' is a
	// placeholder (will eventually read the empire from the Species Builder) and
	// applies no highlighting. See $lib/precursors for the applies-logic.
	let empireFilter = $state<'planner' | EmpireType>('regular');
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
			{#if isHabitable(planet)}
				<span
					class="rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-300/90"
					title="A colonizable world">habitable</span
				>
			{/if}
			{#if isTerraformable(planet)}
				<span
					class="rounded bg-sky-500/10 px-1 text-[10px] text-sky-300/80"
					title="Terraformable into a colony (e.g. with the right ascension perk)"
					>terraformable</span
				>
			{/if}
			{#each chips.resources as r, i (i)}
				<span class="rounded bg-emerald-500/10 px-1 text-[10px] text-emerald-300/90">{r}</span>
			{/each}
			{#each chips.others as o, i (i)}
				<span class="rounded bg-surface-500/15 px-1 text-[10px] opacity-50">{o}</span>
			{/each}
			{#each chips.blockers as b (b.name)}
				<span class="rounded bg-surface-500/20 px-1 text-[10px] opacity-50" title="Planet blocker">
					{b.name}{#if b.count > 1}
						×{b.count}{/if}
				</span>
			{/each}
		</div>
		{#each planet.modifiers as mod (mod.key)}
			<div class="ml-4 flex items-baseline justify-between gap-3 opacity-60">
				<span>{modLabel(mod)}</span>
				<span class="font-mono {valueColor(mod)}">{formatValue(mod)}</span>
			</div>
		{/each}
	</li>
{/snippet}

<!-- One half of a section heading rule (a section header is: rule · LABEL · rule) -->
{#snippet hrule()}
	<span class="border-surface-400-500/40 h-0 flex-1 border-t"></span>
{/snippet}

<!-- A summary badge in a precursor card header (e.g. "Relic", "Buildings ×2"). -->
{#snippet badge(text: string, cls: string)}
	<span class="rounded px-1.5 py-0.5 text-[10px] font-medium {cls}">{text}</span>
{/snippet}

<!-- One precursor building: restrictions, resources, jobs, modifiers. Shared by the
	 home-planet "Buildings" section and the tech-unlocked "Technology" section. -->
{#snippet buildingDetail(b: PrecursorBuilding)}
	{@const cost = b.resources.filter((r) => r.kind === 'cost')}
	{@const upkeep = b.resources.filter((r) => r.kind === 'upkeep')}
	{@const produces = b.resources.filter((r) => r.kind === 'produces')}
	{@const jobs = b.modifiers.filter((m) => m.buildingScope === 'job')}
	{@const effects = b.modifiers.filter((m) => m.buildingScope !== 'job')}
	{@const limit = buildingLimitLabel(b)}
	<div class="border-surface-400-500/20 rounded border p-2">
		<div class="flex flex-wrap items-baseline justify-between gap-x-2">
			<span class="text-sm font-medium">{b.name ?? b.buildingKey}</span>
			{#if buildingScopeLabel(b.scope)}<span class="text-[10px] opacity-40"
					>{buildingScopeLabel(b.scope)}</span
				>{/if}
		</div>

		<!-- Build restrictions -->
		<div class="mt-0.5 flex flex-wrap gap-x-3 text-[10px] opacity-40">
			{#if limit}<span title="How many you can build">Limit: {limit}</span>{/if}
			{#if b.buildTimeDays != null}<span>{b.buildTimeDays}d build time</span>{/if}
			{#if b.canDemolish === false}<span>cannot demolish</span>{/if}
		</div>

		<!-- Cost / upkeep / produces -->
		{#if cost.length || upkeep.length || produces.length}
			<div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs opacity-60">
				{#if cost.length}<span>Cost: {cost.map(buildingResourceLabel).join(', ')}</span>{/if}
				{#if upkeep.length}<span>Upkeep: {upkeep.map(buildingResourceLabel).join(', ')}</span>{/if}
				{#if produces.length}<span class="text-emerald-400/80"
						>Produces: {produces.map(buildingResourceLabel).join(', ')}</span
					>{/if}
			</div>
		{/if}

		<!-- Jobs -->
		{#if jobs.length}
			<div class="mt-1 text-xs">
				<span class="opacity-40">Jobs:</span>
				{#each jobs as j (j.key)}<span class="ml-1 text-sky-300/80">{buildingJobLabel(j)}</span
					>{/each}
			</div>
		{/if}

		<!-- Planet / country / system / station modifiers (base + Archaeo-Engineers) -->
		{#if effects.length}
			<ul class="mt-1 space-y-0.5 text-xs">
				{#each effects as e (e.buildingScope + e.key + (e.condition ?? ''))}
					{@const cond = buildingConditionLabel(e.condition)}
					<li class="flex items-baseline justify-between gap-3">
						<span class="opacity-60"
							>{e.label ?? e.key}{#if cond}<span class="text-primary-400/70">
									({cond})</span
								>{:else if e.buildingScope === 'country'}<span class="opacity-30">
									(empire-wide)</span
								>{/if}</span
						>
						<span class="shrink-0 font-mono {valueColor(e)}">{formatValue(e)}</span>
					</li>
					{#if e.aeValue != null}
						<li class="flex items-baseline justify-between gap-3">
							<span class="pl-3 text-primary-400/60">(with Archaeo-Engineers)</span>
							<span class="shrink-0 font-mono {valueColor({ ...e, value: e.aeValue })}"
								>{formatValue({ ...e, value: e.aeValue })}</span
							>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}
	</div>
{/snippet}

<main class="mx-auto max-w-7xl space-y-8 p-4">
	<h1 class="text-2xl font-bold">Precursors</h1>

	<p class="max-w-3xl text-sm opacity-60">
		The ancient civilisations whose archaeology chains you can uncover. Each grants a
		<strong>permanent empire effect</strong>, usually a <strong>relic</strong>, sometimes a
		<strong>building</strong>, and a unique <strong>home system</strong>.
	</p>

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
		{#each EMPIRE_TYPES as et (et.key)}
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

	{#each groups as group (group.label)}
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
					{@const planetBuildings = p.buildings.filter((b) => b.scope !== 'starbase')}
					{@const stationBuildings = p.buildings.filter((b) => b.scope === 'starbase')}
					<article class="border-surface-400-500/30 rounded-lg border p-4">
						<div class="space-y-4">
							<!-- Card header -->
							<header>
								<h3 class="text-lg font-semibold">{p.name ?? p.key}</h3>
								<div class="mt-1 flex flex-wrap items-center gap-1.5">
									{#if p.relic}{@render badge('Relic', 'bg-amber-500/15 text-amber-300/90')}{/if}
									{#if planetBuildings.length}{@render badge(
											countLabel('Building', planetBuildings.length),
											'bg-sky-500/15 text-sky-300/90'
										)}{/if}
									{#if stationBuildings.length}{@render badge(
											countLabel('Station building', stationBuildings.length),
											'bg-cyan-500/15 text-cyan-300/90'
										)}{/if}
									{#if p.systems.length}{@render badge(
											countLabel('System', p.systems.length),
											'bg-violet-500/15 text-violet-300/90'
										)}{/if}
									{#if habitableWorldCount(p) > 0}{@render badge(
											countLabel('Habitable world', habitableWorldCount(p)),
											'bg-emerald-500/15 text-emerald-300/90'
										)}{/if}
									{#if terraformableWorldCount(p) > 0}{@render badge(
											countLabel('Toxic world', terraformableWorldCount(p)),
											'bg-lime-500/15 text-lime-300/90'
										)}{/if}
									{#if moltenWorldCount(p) > 0}{@render badge(
											countLabel('Molten world', moltenWorldCount(p)),
											'bg-orange-500/15 text-orange-300/90'
										)}{/if}
									{#if p.numDigsites}{@render badge(
											countLabel('Dig site', p.numDigsites),
											'bg-surface-500/25 opacity-70'
										)}{/if}
								</div>
							</header>

							<!-- Permanent empire effect (reward modifiers, merged across empire-type/choice variants) -->
							{#if p.rewards.length}
								<div>
									<div
										class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-55"
									>
										{@render hrule()}<span>Permanent effect</span>{@render hrule()}
									</div>
									<ul class="space-y-0.5">
										{#each mergeRewardModifiers(p.rewards) as m (m.key + m.value)}
											{@const q = rewardQualifier(m)}
											{@const applies = activeType ? m.types.includes(activeType) : null}
											<li
												class="flex items-baseline justify-between gap-3 text-sm {applies === false
													? 'opacity-30'
													: ''}"
											>
												<span class="opacity-70">
													{modLabel(m)}
													{#if q}<span
															class="text-[10px] {applies === true
																? 'text-primary-400'
																: 'opacity-40'}">({q})</span
														>{/if}
												</span>
												<span class="shrink-0 font-mono {valueColor(m)}">{formatValue(m)}</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}

							<!-- Home-world discovery reward (one-time resource burst + minor artifacts) -->
							{#if p.homeworldRewards.length}
								<div>
									<div
										class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-55"
									>
										{@render hrule()}<span>Homeworld reward</span>{@render hrule()}
									</div>
									<p class="mb-1 text-[11px] opacity-40">
										One-time, granted when the home world is finally found. Resource grants scale
										with your empire's current monthly output of that resource (the ×N factor),
										clamped to the shown range.
									</p>
									<ul class="space-y-0.5 text-sm">
										{#each p.homeworldRewards as reward (reward.resource)}
											<li class="opacity-70">{homeworldRewardLabel(reward)}</li>
										{/each}
									</ul>
								</div>
							{/if}

							<!-- Relic -->
							{#if p.relic}
								<div>
									<div
										class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-55"
									>
										{@render hrule()}<span
											>Relic — <span class="text-amber-300/80 normal-case"
												>{p.relic.name ?? p.relic.relicKey}</span
											></span
										>{@render hrule()}
									</div>
									{#if p.relic.passives.length}
										<ul class="space-y-0.5">
											{#each mergeRelicPassives(p.relic.passives) as passive (passive.key + passive.value)}
												{@const cond = typesLabel(passive.types)}
												{@const applies = activeType ? passive.types.includes(activeType) : null}
												<li
													class="flex items-baseline justify-between gap-3 text-sm {applies ===
													false
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
									{#each p.relic.passiveTexts as pt (pt.text)}
										{@const cond = conditionLabel(pt.condition)}
										{@const applies = activeType
											? conditionApplies(pt.condition, activeType)
											: null}
										<p class="mt-0.5 text-sm {applies === false ? 'opacity-30' : 'opacity-70'}">
											{pt.text}
											{#if cond}<span
													class="text-[10px] {applies === true ? 'text-primary-400' : 'opacity-40'}"
													>({cond})</span
												>{/if}
										</p>
									{/each}
									{#if p.relic.activeEffect || p.relic.activeModifiers.length || p.relic.produces.length || p.relic.costs.length || p.relic.triumphCooldownDays}
										{@const cd = cooldownLabel(p.relic.triumphCooldownDays)}
										<div class="mt-2">
											<div
												class="mb-0.5 text-[10px] font-medium tracking-wide uppercase opacity-40"
											>
												Triumph (active)
											</div>
											{#if p.relic.activeEffect}
												<p class="text-sm opacity-70">{p.relic.activeEffect}</p>
											{/if}
											{#if p.relic.activeModifiers.length}
												{#each groupActiveModifiers(p.relic.activeModifiers) as grp, i (i)}
													{#if grp.label}
														<div class="mt-1 text-[11px] font-medium opacity-60">{grp.label}</div>
													{/if}
													<ul class="space-y-0.5 {grp.label ? 'ml-3' : ''}">
														{#each grp.modifiers as mod (mod.key)}
															<li class="flex items-baseline justify-between gap-3 text-sm">
																<span class="opacity-70">{modLabel(mod)}</span>
																<span class="shrink-0 font-mono {valueColor(mod)}"
																	>{formatValue(mod)}</span
																>
															</li>
														{/each}
													</ul>
												{/each}
												{#if p.relic.activeDetail}<p class="mt-0.5 text-[11px] italic opacity-50">
														{p.relic.activeDetail}
													</p>{/if}
											{/if}
											{#if p.relic.produces.length}
												<p class="text-sm opacity-70">
													Produces <span class="text-emerald-400"
														>{relicResourceLabel(p.relic.produces)}</span
													>
												</p>
											{/if}
											{#if p.relic.costs.length || cd}
												<div
													class="mt-0.5 flex items-baseline justify-between gap-x-3 text-[11px] opacity-50"
												>
													<span>
														{#if p.relic.costs.length}Cost:
															<span class="opacity-80">{relicResourceLabel(p.relic.costs)}</span
															>{/if}
													</span>
													{#if cd}<span class="shrink-0 opacity-80">{cd} cooldown</span>{/if}
												</div>
											{/if}
										</div>
									{/if}
								</div>
							{/if}

							<!-- Home-planet buildings (granted directly): effects + restrictions -->
							{#if p.buildings.some((b) => b.source === 'homeworld')}
								{@const homeBuildings = p.buildings.filter((b) => b.source === 'homeworld')}
								<div>
									<div
										class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-55"
									>
										{@render hrule()}<span>Building{homeBuildings.length === 1 ? '' : 's'}</span
										>{@render hrule()}
									</div>
									<div class="space-y-3">
										{#each homeBuildings as b (b.buildingKey)}{@render buildingDetail(b)}{/each}
									</div>
								</div>
							{/if}

							<!-- Technology: the "Secrets of …" tech + the empire-wide building it unlocks -->
							{#if p.technology}
								{@const tech = p.technology}
								{@const techBuilding = p.buildings.find(
									(b) => b.buildingKey === tech.unlocksBuildingKey
								)}
								<div>
									<div
										class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-55"
									>
										{@render hrule()}<span>Technology</span>{@render hrule()}
									</div>
									<p class="mb-2 text-[11px] opacity-40">
										A permanent research option from the <span class="opacity-70"
											>Secrets of the {p.name}</span
										> discovery project (can't appear in normal research draws), unlocking:
									</p>
									<div class="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm">
										<span class="font-medium">{tech.name ?? tech.techKey}</span>
										<span class="text-[10px] opacity-40">
											{#if tech.cost != null}{tech.cost.toLocaleString('en-US')} research{/if}{#if tech.tier != null}
												· tier {tech.tier}{/if}
										</span>
									</div>
									{#if techBuilding}{@render buildingDetail(techBuilding)}{/if}
								</div>
							{/if}

							<!-- Home system(s): relevant bodies shown, rest behind "show more" -->
							{#if p.systems.length}
								<div>
									<div
										class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-55"
									>
										{@render hrule()}<span>Home system{p.systems.length === 1 ? '' : 's'}</span
										>{@render hrule()}
									</div>
									<div class="space-y-2">
										{#each p.systems as sys (sys.initializer)}
											{@const shown = shownPlanets(sys.planets)}
											{@const relevant = shown.filter(isRelevant)}
											{@const rest = shown.filter((pl) => !isRelevant(pl))}
											<div class="border-surface-400-500/20 rounded border p-2">
												<div class="mb-1 flex flex-wrap items-baseline gap-2">
													<span class="text-sm font-medium">{sys.name ?? sys.initializer}</span>
													{#each sys.megastructures as ms (ms.type)}
														<span
															class="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300"
														>
															{megaLabel(ms)}
														</span>
													{/each}
													{#if hasMoltenWorld(sys)}
														<span
															class="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] text-orange-300/90"
															title="A Molten World here can host an Arc Furnace, which adds a mining deposit (1–4 minerals each, by furnace level) to every non-habitable body in the system"
															>Arc Furnace → {arcFurnaceDepositCount(sys)} mining deposits</span
														>
													{/if}
												</div>
												{#if relevant.length}
													<ul class="space-y-1">
														{#each relevant as planet (planet.id)}{@render planetRow(planet)}{/each}
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
															{#each rest as planet (planet.id)}{@render planetRow(planet)}{/each}
														</ul>
													</details>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		</section>
	{/each}
</main>
