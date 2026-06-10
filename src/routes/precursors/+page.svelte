<script lang="ts">
	import type { PageData } from './$types';
	import type { Precursor, PrecursorReward, Modifier, RelicModifier, DepositResource, PrecursorPlanet } from '$lib/server/db';

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

	// ── Group by DLC, preserving load order ──
	type Group = { dlc: string | null; label: string; items: Precursor[] };
	const groups = $derived.by(() => {
		const order: (string | null)[] = [];
		const byDlc = new Map<string | null, Precursor[]>();
		for (const p of precursors) {
			if (!byDlc.has(p.requiredDlc)) {
				byDlc.set(p.requiredDlc, []);
				order.push(p.requiredDlc);
			}
			byDlc.get(p.requiredDlc)!.push(p);
		}
		return order.map((dlc) => ({
			dlc,
			label: dlc ?? 'Base game',
			items: byDlc.get(dlc)!
		})) as Group[];
	});

	// ── Formatting ─────────────────────────────────────────────────────────
	function formatValue(mod: Modifier): string {
		const sign = mod.value > 0 ? '+' : '';
		if (mod.key.endsWith('_add')) {
			const n = Number.isInteger(mod.value) ? mod.value : parseFloat(mod.value.toFixed(2));
			return `${sign}${n}`;
		}
		return `${sign}${Math.round(mod.value * 100)}%`;
	}
	function valueColor(mod: Modifier): string {
		return mod.value > 0 === mod.positiveIsGood ? 'text-emerald-400' : 'text-red-400';
	}
	function modLabel(mod: Modifier): string {
		if (!mod.label) {
			return mod.key
				.split('_')
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(' ');
		}
		return mod.label.replace(/\[.*?\]/g, '').trim() || mod.key;
	}

	// Variant descriptor for reward modifiers. Vultaum's variants share the same
	// loc name ("Secrets of the Vultaum"), so distinguish by empire type / choice.
	// Only one variant is ever active, depending on empire type (and a choice).
	const VARIANT_LABELS: Record<string, string> = {
		default: 'Regular empire',
		suppressed: 'Regular empire — research kept secret',
		public: 'Regular empire — research made public',
		machine: 'Machine empire',
		hive: 'Hive mind',
		hive_machine: 'Hive mind / Machine empire'
	};
	function variantLabel(r: PrecursorReward): string {
		return VARIANT_LABELS[r.variant] ?? r.name ?? r.variant;
	}

	// Relic passive condition → short human note.
	function conditionLabel(c: string | null): string | null {
		if (!c) return null;
		const map: Record<string, string> = {
			'is_machine_empire = no': 'non-machine',
			'is_machine_empire = yes': 'machine',
			'is_wilderness_empire = no': 'non-wilderness',
			'is_wilderness_empire = yes': 'wilderness',
			OR: 'machine / hive'
		};
		return map[c] ?? c;
	}

	function resourceLabel(res: DepositResource): string {
		const name = res.resource
			.replace(/_research$/, '')
			.split('_')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
		const sign = res.kind === 'produces' ? '+' : '';
		return `${sign}${res.amount} ${name}`;
	}

	// Render-worthy planets: skip bare stars (no label/size/deposits/modifiers).
	function shownPlanets(planets: PrecursorPlanet[]): PrecursorPlanet[] {
		return planets.filter(
			(p) =>
				p.planetClass !== 'star' &&
				(p.planetClassLabel || p.size != null || p.deposits.length > 0 || p.modifiers.length > 0)
		);
	}

	// Planet classes worth showing at a glance: habitable/colonizable worlds, the
	// special precursor worlds, and ringworld sections.
	const RELEVANT_CLASSES = new Set([
		'pc_desert', 'pc_arid', 'pc_savannah', 'pc_tropical', 'pc_continental', 'pc_ocean',
		'pc_tundra', 'pc_arctic', 'pc_alpine', 'pc_gaia', 'pc_hive', 'pc_machine',
		'pc_city', 'pc_habitat', 'pc_ringworld_habitable', 'pc_cybrex',
		'pc_relic', 'pc_nuked', 'pc_broken'
	]);
	// Not habitable as-is, but terraformable into a colony (e.g. Toxic via Toxoid AP).
	const TERRAFORM_CANDIDATE = new Set(['pc_toxic']);

	// Shown by default: homeworlds, anything with a resource deposit or a modifier,
	// habitable worlds, terraform candidates. The rest (barren/asteroids/gas giants
	// with no deposits) goes behind "show more".
	function isRelevant(p: PrecursorPlanet): boolean {
		return (
			p.isHomeworld ||
			p.deposits.some((d) => !d.isBlocker) ||
			p.modifiers.length > 0 ||
			RELEVANT_CLASSES.has(p.planetClass ?? '') ||
			TERRAFORM_CANDIDATE.has(p.planetClass ?? '')
		);
	}
	const isTerraformable = (p: PrecursorPlanet) => TERRAFORM_CANDIDATE.has(p.planetClass ?? '');

	// Group a planet's deposits for compact display: resource yields individually,
	// blockers collapsed by name with a ×count.
	function depositChips(deposits: PrecursorPlanet['deposits']) {
		const resources: string[] = [];
		const blockers = new Map<string, number>();
		const others: string[] = [];
		for (const d of deposits) {
			if (d.isBlocker) {
				const name = d.name ?? d.depositKey;
				blockers.set(name, (blockers.get(name) ?? 0) + 1);
			} else if (d.resources.length) {
				for (const r of d.resources) resources.push(resourceLabel(r));
			} else {
				others.push(d.name ?? d.depositKey);
			}
		}
		return {
			resources,
			others,
			blockers: [...blockers].map(([name, count]) => ({ name, count }))
		};
	}

	const dlcBadge = (dlc: string | null) =>
		dlc === null
			? 'border-surface-400-500/40 opacity-50'
			: dlc.includes('Ancient')
				? 'border-amber-500/50 text-amber-300'
				: 'border-sky-500/50 text-sky-300';
</script>

{#snippet planetRow(planet: PrecursorPlanet)}
	{@const chips = depositChips(planet.deposits)}
	<li class="text-xs">
		<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
			{#if planet.isHomeworld}<span class="text-amber-300/80" title="Precursor homeworld">★</span>{/if}
			<span class="opacity-80">{planet.planetClassLabel ?? planet.planetClass}</span>
			{#if planet.size != null}<span class="opacity-40">size {planet.size}</span>{/if}
			{#if isTerraformable(planet)}
				<span class="rounded bg-sky-500/10 px-1 text-[10px] text-sky-300/80" title="Terraformable into a colony (e.g. with the right ascension perk)">terraformable</span>
			{/if}
			{#each chips.resources as r}
				<span class="rounded bg-emerald-500/10 px-1 text-[10px] text-emerald-300/90">{r}</span>
			{/each}
			{#each chips.others as o}
				<span class="rounded bg-surface-500/15 px-1 text-[10px] opacity-50">{o}</span>
			{/each}
			{#each chips.blockers as b}
				<span class="rounded bg-surface-500/20 px-1 text-[10px] opacity-50" title="Planet blocker">
					{b.name}{#if b.count > 1} ×{b.count}{/if}
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

	{#each groups as group}
		<section class="space-y-3">
			<h2 class="flex items-center gap-2 text-lg font-semibold">
				{group.label}
				{#if group.dlc}
					<span class="rounded border px-1.5 py-0.5 text-[10px] font-normal {dlcBadge(group.dlc)}">DLC</span>
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
								<input type="checkbox" class="checkbox" checked={on} onchange={() => toggle(p.key)} />
								<span class="opacity-60">{on ? 'Available' : 'Off'}</span>
							</label>
						</header>

						<!-- Permanent empire effect (reward modifiers) -->
						{#if p.rewards.length}
							<div class="mb-3">
								<h4 class="mb-1 text-xs font-medium uppercase tracking-wide opacity-40">
									Permanent effect
								</h4>
								{#if p.rewards.length > 1}
									<p class="mb-1.5 text-[11px] italic opacity-40">
										Only one applies, by empire type / choice:
									</p>
								{/if}
								<div class="space-y-2">
									{#each p.rewards as reward}
										<div>
											{#if p.rewards.length > 1}
												<div class="text-[11px] font-medium opacity-60">
													{variantLabel(reward)}
													{#if reward.name}<span class="font-normal opacity-40">· {reward.name}</span>{/if}
												</div>
											{/if}
											<ul class="space-y-0.5">
												{#each reward.modifiers as mod}
													<li class="flex items-baseline justify-between gap-3 text-sm">
														<span class="opacity-70">{modLabel(mod)}</span>
														<span class="shrink-0 font-mono {valueColor(mod)}">{formatValue(mod)}</span>
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
								<h4 class="mb-1 text-xs font-medium uppercase tracking-wide opacity-40">
									Relic — <span class="text-amber-300/80 normal-case">{p.relic.name ?? p.relic.relicKey}</span>
								</h4>
								{#if p.relic.passives.length}
									<ul class="space-y-0.5">
										{#each p.relic.passives as passive}
											{@const cond = conditionLabel((passive as RelicModifier).condition)}
											<li class="flex items-baseline justify-between gap-3 text-sm">
												<span class="opacity-70">
													{modLabel(passive)}
													{#if cond}<span class="text-[10px] opacity-40">({cond})</span>{/if}
												</span>
												<span class="shrink-0 font-mono {valueColor(passive)}">{formatValue(passive)}</span>
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
								<h4 class="mb-1 text-xs font-medium uppercase tracking-wide opacity-40">Building</h4>
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
								<h4 class="mb-1 text-xs font-medium uppercase tracking-wide opacity-40">
									Home system{p.systems.length === 1 ? '' : 's'}
								</h4>
								<div class="space-y-2">
									{#each p.systems as sys}
										{@const shown = shownPlanets(sys.planets)}
										{@const relevant = shown.filter(isRelevant)}
										{@const rest = shown.filter((pl) => !isRelevant(pl))}
										<div class="rounded border border-surface-400-500/20 p-2">
											<div class="mb-1 flex flex-wrap items-baseline gap-2">
												<span class="text-sm font-medium">{sys.name ?? sys.initializer}</span>
												{#each sys.megastructures as ms}
													<span class="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300">
														{ms.label ?? ms.type}
													</span>
												{/each}
											</div>
											{#if relevant.length}
												<ul class="space-y-1">
													{#each relevant as planet}{@render planetRow(planet)}{/each}
												</ul>
											{:else if sys.megastructures.length === 0}
												<p class="text-xs italic opacity-40">No habitable worlds or notable deposits.</p>
											{/if}
											{#if rest.length}
												<details class="group mt-1.5">
													<summary class="cursor-pointer list-none text-[11px] opacity-40 hover:opacity-70">
														<span class="inline-block transition-transform group-open:rotate-90">▸</span>
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
