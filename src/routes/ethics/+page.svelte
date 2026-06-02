<script lang="ts">
	import type { PageData } from './$types';
	import type { Ethic, Modifier } from '$lib/server/db';

	let { data }: { data: PageData } = $props();

	// ── Ethic axes (opposite pairs, displayed as rows) ──────────────────────
	const AXES: [string, string][] = [
		['ethic_authoritarian', 'ethic_egalitarian'],
		['ethic_xenophobe', 'ethic_xenophile'],
		['ethic_militarist', 'ethic_pacifist'],
		['ethic_spiritualist', 'ethic_materialist']
	];

	// Modifier keys that directly affect civilian pops
	const CIVILIAN_KEYS = new Set([
		'pop_cat_worker_bonus_workforce_mult',
		'pop_cat_specialist_bonus_workforce_mult',
		'pop_cat_ruler_bonus_workforce_mult',
		'pop_factions_produces_mult',
		'empire_size_pops_mult',
		'planet_stability_add',
		'planet_pops_robotics_upkeep_mult',
		'founder_species_growth_mult',
		'planet_jobs_trade_produces_mult'
	]);

	const ETHIC_BUDGET = 3;

	// ── Lookup helpers ───────────────────────────────────────────────────────
	const ethicMap = $derived(new Map(data.ethics.map((e) => [e.key, e])));

	// For each axis entry (regular key), find its fanatic variant in data
	function getFanatic(regularKey: string): Ethic | undefined {
		const e = ethicMap.get(regularKey);
		return e?.fanatic_variant ? ethicMap.get(e.fanatic_variant) : undefined;
	}

	// ── Selection state ──────────────────────────────────────────────────────
	let selected = $state(new Set<string>());

	const pointsUsed = $derived(
		[...selected].reduce((sum, k) => sum + (ethicMap.get(k)?.cost ?? 0), 0)
	);
	const pointsRemaining = $derived(ETHIC_BUDGET - pointsUsed);

	function axisKeys(regularKey: string): string[] {
		const fanatic = getFanatic(regularKey);
		return fanatic ? [regularKey, fanatic.key] : [regularKey];
	}

	function oppositeKeys(regularKey: string): string[] {
		const other = AXES.find(([a, b]) => a === regularKey || b === regularKey);
		if (!other) return [];
		const otherSide = other[0] === regularKey ? other[1] : other[0];
		return axisKeys(otherSide);
	}

	function isBlocked(ethicKey: string): boolean {
		if (selected.has(ethicKey)) return false;
		const e = ethicMap.get(ethicKey);
		if (!e) return true;
		// Over budget
		if (pointsRemaining < e.cost) return true;
		// Opposite axis selected
		const reg = e.regular_variant ?? ethicKey;
		const opp = oppositeKeys(reg);
		if (opp.some((k) => selected.has(k))) return true;
		// Same axis (regular + fanatic conflict)
		const sameAxis = axisKeys(reg);
		if (sameAxis.filter((k) => k !== ethicKey).some((k) => selected.has(k))) return true;
		return false;
	}

	function toggle(ethicKey: string) {
		const next = new Set(selected);
		if (next.has(ethicKey)) {
			next.delete(ethicKey);
		} else if (!isBlocked(ethicKey)) {
			next.add(ethicKey);
		}
		selected = next;
	}

	function selectGestalt() {
		const g = data.ethics.find((e: Ethic) => e.gestalt);
		if (!g) return;
		if (selected.has(g.key)) {
			selected = new Set();
		} else {
			selected = new Set([g.key]);
		}
	}

	// ── Combined modifiers for selected ethics ───────────────────────────────
	const selectedEthics = $derived(data.ethics.filter((e: Ethic) => selected.has(e.key)));

	const combinedModifiers = $derived.by(() => {
		const map = new Map<string, { modifier: Modifier; sources: string[] }>();
		for (const ethic of selectedEthics) {
			for (const mod of ethic.modifiers) {
				if (map.has(mod.key)) {
					const entry = map.get(mod.key)!;
					entry.modifier = { ...mod, value: entry.modifier.value + mod.value };
					entry.sources.push(ethic.label ?? ethic.key);
				} else {
					map.set(mod.key, {
						modifier: { ...mod },
						sources: [ethic.label ?? ethic.key]
					});
				}
			}
		}
		return [...map.values()];
	});

	const civilianCombined = $derived(combinedModifiers.filter((e: { modifier: Modifier; sources: string[] }) => CIVILIAN_KEYS.has(e.modifier.key)));
	const otherCombined = $derived(combinedModifiers.filter((e: { modifier: Modifier; sources: string[] }) => !CIVILIAN_KEYS.has(e.modifier.key)));

	// ── Civilian comparison table (all non-gestalt ethics) ──────────────────
	const nonGestaltEthics = $derived(data.ethics.filter((e: Ethic) => !e.gestalt));

	const civilianModifierKeys = $derived.by(() => {
		const keys: string[] = [];
		for (const e of nonGestaltEthics) {
			for (const mod of e.modifiers) {
				if (CIVILIAN_KEYS.has(mod.key) && !keys.includes(mod.key)) {
					keys.push(mod.key);
				}
			}
		}
		return keys;
	});

	// ── Formatting ───────────────────────────────────────────────────────────
	function formatValue(mod: Modifier): string {
		const sign = mod.value > 0 ? '+' : '';
		if (mod.key.endsWith('_add')) {
			const n = Number.isInteger(mod.value) ? mod.value : parseFloat(mod.value.toFixed(2));
			return `${sign}${n}`;
		}
		return `${sign}${Math.round(mod.value * 100)}%`;
	}

	function valueColor(mod: Modifier): string {
		return (mod.value > 0) === mod.positiveIsGood ? 'text-emerald-400' : 'text-red-400';
	}

	function modLabel(mod: Modifier): string {
		if (!mod.label) {
			return mod.key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
		}
		// Strip unresolved game script tags like [This.GetEaterColor]
		return mod.label.replace(/\[.*?\]/g, '').trim() || mod.key;
	}

	function ethicLabel(e: Ethic): string {
		return e.label ?? e.key;
	}

	function costDots(cost: number): string {
		return '●'.repeat(cost) + '○'.repeat(ETHIC_BUDGET - cost);
	}
</script>

<main class="mx-auto max-w-7xl space-y-8 p-4">
	<div class="flex items-baseline gap-4">
		<h1 class="text-2xl font-bold">Ethics</h1>
		<nav class="flex gap-3 text-sm opacity-50">
			<a href="/" class="hover:opacity-100 transition-opacity">← Species Builder</a>
		</nav>
	</div>

	<!-- Budget indicator -->
	<div class="flex items-center gap-3">
		<div class="flex gap-1.5">
			{#each Array.from({ length: ETHIC_BUDGET }) as _, i}
				<span
					class="h-4 w-4 rounded-full border-2 transition-all
						{i < pointsUsed
						? 'border-primary-500'
						: 'bg-primary-500 border-primary-500'}"
				></span>
			{/each}
		</div>
		<span class="text-sm opacity-60">
			<strong class={pointsRemaining < 0 ? 'text-red-400' : ''}>{pointsRemaining}</strong>
			/ {ETHIC_BUDGET} ethic points remaining
		</span>
		{#if selected.size > 0}
			<button class="btn text-xs preset-filled" onclick={() => (selected = new Set())}>
				Clear
			</button>
		{/if}
	</div>

	<!-- Ethics picker -->
	<div class="space-y-2">
		{#each AXES as [leftKey, rightKey]}
			{@const leftEthic = ethicMap.get(leftKey)}
			{@const rightEthic = ethicMap.get(rightKey)}
			{@const leftFanatic = getFanatic(leftKey)}
			{@const rightFanatic = getFanatic(rightKey)}
			{#if leftEthic && rightEthic}
				<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
					<!-- Left side -->
					<div class="flex justify-end gap-1.5">
						{#each ([leftEthic, leftFanatic] as (Ethic | undefined)[]).filter((e): e is Ethic => !!e) as ethic}
							{@const blocked = isBlocked(ethic!.key)}
							{@const sel = selected.has(ethic!.key)}
							<button
								class="btn text-sm flex-col gap-0.5 leading-tight
									{sel ? 'preset-filled-primary-500' : blocked ? 'preset-filled opacity-30 cursor-not-allowed' : 'preset-filled card-hover'}"
								onclick={() => toggle(ethic!.key)}
								disabled={blocked && !sel}
							>
								<span>{ethicLabel(ethic!)}</span>
								<span class="text-[10px] opacity-60 font-mono">{'●'.repeat(ethic!.cost)}</span>
							</button>
						{/each}
					</div>

					<!-- Axis separator -->
					<span class="select-none text-xs opacity-20">|</span>

					<!-- Right side -->
					<div class="flex justify-start gap-1.5">
						{#each ([rightEthic, rightFanatic] as (Ethic | undefined)[]).filter((e): e is Ethic => !!e) as ethic}
							{@const blocked = isBlocked(ethic!.key)}
							{@const sel = selected.has(ethic!.key)}
							<button
								class="btn text-sm flex-col gap-0.5 leading-tight
									{sel ? 'preset-filled-primary-500' : blocked ? 'preset-filled opacity-30 cursor-not-allowed' : 'preset-filled card-hover'}"
								onclick={() => toggle(ethic!.key)}
								disabled={blocked && !sel}
							>
								<span>{ethicLabel(ethic!)}</span>
								<span class="text-[10px] opacity-60 font-mono">{'●'.repeat(ethic!.cost)}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		{/each}

		<!-- Gestalt Consciousness -->
		{#each data.ethics.filter((e: Ethic) => e.gestalt) as gestaltEthic}
			{@const sel = selected.has(gestaltEthic.key)}
			{@const blocked = !sel && pointsRemaining < gestaltEthic.cost && selected.size === 0}
			<div class="flex items-center gap-2 pt-1 border-t border-surface-400-500/30">
				<span class="text-xs opacity-40 w-20 shrink-0 text-right">Gestalt</span>
				<span class="select-none text-xs opacity-20">|</span>
				<button
					class="btn text-sm flex-col gap-0.5 leading-tight
						{sel ? 'preset-filled-primary-500' : 'preset-filled card-hover'}"
					onclick={selectGestalt}
				>
					<span>{ethicLabel(gestaltEthic)}</span>
					<span class="text-[10px] opacity-60 font-mono">{'●'.repeat(gestaltEthic.cost)}</span>
				</button>
			</div>
		{/each}
	</div>

	<!-- Selected ethics effects -->
	{#if selectedEthics.length > 0}
		<section class="space-y-4">
			<h2 class="text-lg font-semibold">
				{selectedEthics.map(ethicLabel).join(' + ')}
			</h2>

			{#if otherCombined.length > 0}
				<div>
					<h3 class="mb-2 text-sm font-medium opacity-60">Empire Effects</h3>
					<ul class="space-y-1">
						{#each otherCombined as { modifier, sources }}
							<li class="flex items-baseline justify-between gap-4 text-sm">
								<span class="opacity-70">{modLabel(modifier)}</span>
								<span class="font-mono shrink-0 {valueColor(modifier)}">{formatValue(modifier)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if civilianCombined.length > 0}
				<div>
					<h3 class="mb-2 text-sm font-medium opacity-60">Civilian Effects</h3>
					<ul class="space-y-1">
						{#each civilianCombined as { modifier, sources }}
							<li class="flex items-baseline justify-between gap-4 text-sm">
								<span class="opacity-70">{modLabel(modifier)}</span>
								<span class="font-mono shrink-0 {valueColor(modifier)}">{formatValue(modifier)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	{/if}

	<!-- Civilian modifiers comparison table -->
	{#if civilianModifierKeys.length > 0}
		<section>
			<h2 class="mb-3 text-lg font-semibold">Civilian Modifiers by Ethic</h2>
			<p class="mb-4 text-sm opacity-50">Pop-level effects — not shown as a dedicated section in the game.</p>
			<div class="overflow-x-auto">
				<table class="w-full text-xs">
					<thead>
						<tr class="border-b border-surface-400-500/40">
							<th class="py-1.5 pr-4 text-left font-medium opacity-60 w-48">Modifier</th>
							{#each nonGestaltEthics as ethic}
								<th
									class="py-1.5 px-2 text-center font-medium leading-tight
										{selected.has(ethic.key) ? 'text-primary-400' : 'opacity-60'}"
									style="min-width: 4rem"
								>
									{ethicLabel(ethic)}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each civilianModifierKeys as modKey}
							{@const anyMod = nonGestaltEthics.flatMap((e: Ethic) => e.modifiers).find((m: Modifier) => m.key === modKey)}
							<tr class="border-b border-surface-400-500/20 hover:bg-surface-500/10">
								<td class="py-1.5 pr-4 opacity-70">{anyMod ? modLabel(anyMod) : modKey}</td>
								{#each nonGestaltEthics as ethic}
									{@const mod = ethic.modifiers.find((m: Modifier) => m.key === modKey)}
									<td class="py-1.5 px-2 text-center font-mono">
										{#if mod}
											<span
												class="{valueColor(mod)}
													{selected.has(ethic.key) ? 'font-bold' : 'opacity-70'}"
											>
												{formatValue(mod)}
											</span>
										{:else}
											<span class="opacity-20">—</span>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</main>
