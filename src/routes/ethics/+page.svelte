<script lang="ts">
	import type { PageData } from './$types';
	import type { Ethic, Modifier, EthicImplication, PolicyRestriction } from '$lib/server/db';
	import { empire } from '$lib/empire.svelte';
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';
	import { combineImplications, combinePolicyRestrictions, MONUMENT_BONUSES } from '$lib/ethics';
	import Tip from '$lib/Tip.svelte';

	let { data }: { data: PageData } = $props();
	// Debug: render selectable cards as plain elements so their text can be copied.
	const debug = $derived(data.debugDisableSelection);

	// ── Ethic axes (opposite pairs, displayed as rows) ──────────────────────
	const AXES: [string, string][] = [
		['ethic_authoritarian', 'ethic_egalitarian'],
		['ethic_xenophobe', 'ethic_xenophile'],
		['ethic_militarist', 'ethic_pacifist'],
		['ethic_spiritualist', 'ethic_materialist']
	];

	const ETHIC_BUDGET = 3;

	// ── Lookup helpers ───────────────────────────────────────────────────────
	const ethicMap = $derived(new Map(data.ethics.map((e) => [e.key, e])));

	// For each axis entry (regular key), find its fanatic variant in data
	function getFanatic(regularKey: string): Ethic | undefined {
		const e = ethicMap.get(regularKey);
		return e?.fanatic_variant ? ethicMap.get(e.fanatic_variant) : undefined;
	}

	// ── Selection state (backed by the shared empire draft) ───────────────────
	const selected = $derived(new Set(empire.draft.ethics));

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
		empire.setEthics([...next]);
	}

	function selectGestalt() {
		const g = data.ethics.find((e: Ethic) => e.gestalt);
		if (!g) return;
		empire.setEthics(selected.has(g.key) ? [] : [g.key]);
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

	// Deduplicated implications from all selected ethics, with source tracking
	const combinedImplications = $derived(combineImplications(selectedEthics));

	// All unique tags across all non-gestalt ethics, for the reference table
	const allImplicationTags = $derived.by(() => {
		const tags: { tag: string; label: string }[] = [];
		for (const e of nonGestaltEthics) {
			for (const imp of e.implications) {
				if (!tags.some((t) => t.tag === imp.tag)) tags.push(imp);
			}
		}
		return tags;
	});

	// Gestalt implications (shown separately since gestalt has no fanatic/regular split)
	const gestaltImplications = $derived(
		data.ethics.find((e: Ethic) => e.gestalt)?.implications ?? []
	);

	// Policy restrictions for the current selection, deduplicated by option key
	const selectedPolicyRestrictions = $derived(combinePolicyRestrictions(selectedEthics));

	// All unique policy restrictions across non-gestalt ethics, for the reference table
	const allPolicyRestrictions = $derived.by(() => {
		const seen = new Map<string, { policyKey: string; optionKey: string; label: string }>();
		for (const e of nonGestaltEthics) {
			for (const pr of e.policyRestrictions) {
				const id = `${pr.policyKey}:${pr.optionKey}`;
				if (!seen.has(id)) {
					seen.set(id, {
						policyKey: pr.policyKey,
						optionKey: pr.optionKey,
						label: pr.optionLabel ?? pr.optionKey
					});
				}
			}
		}
		return [...seen.values()];
	});

	// ── Comparison tables ────────────────────────────────────────────────────
	// One column per ethic family (regular + fanatic paired), following AXES order
	const tableEthicPairs = $derived(
		AXES.flatMap(([leftKey, rightKey]) =>
			[leftKey, rightKey]
				.map((baseKey) => ({ regular: ethicMap.get(baseKey), fanatic: getFanatic(baseKey) }))
				.filter((p): p is { regular: Ethic; fanatic: Ethic | undefined } => !!p.regular)
		)
	);

	const nonGestaltEthics = $derived(data.ethics.filter((e: Ethic) => !e.gestalt));

	// All modifier keys that appear across any non-gestalt ethic
	const allModifierKeys = $derived.by(() => {
		const keys: string[] = [];
		for (const e of nonGestaltEthics) {
			for (const mod of e.modifiers) {
				if (!keys.includes(mod.key)) keys.push(mod.key);
			}
		}
		return keys;
	});

	// ── Formatting ───────────────────────────────────────────────────────────
	// Value (fractions vs percentages), good/bad colouring, and label formatting all
	// live in one place: $lib/civics.
	const formatValue = formatModifierValue;
	const valueColor = modifierColor;
	const modLabel = modifierLabel;

	function ethicLabel(e: Ethic): string {
		return e.label ?? e.key;
	}

	function ethicTooltip(ethic: Ethic): string {
		if (ethic.modifiers.length === 0) return ethicLabel(ethic);
		return ethic.modifiers.map((mod) => `${formatValue(mod)}  ${modLabel(mod)}`).join('\n');
	}
</script>

<main class="mx-auto max-w-7xl space-y-8 p-4">
	<h1 class="text-2xl font-bold">Ethics</h1>

	<!-- Budget indicator -->
	<div class="flex items-center gap-3">
		<div class="flex gap-1.5">
			{#each Array.from({ length: ETHIC_BUDGET }) as _, i (i)}
				<span
					class="h-4 w-4 rounded-full border-2 transition-all
						{i < pointsUsed ? 'border-primary-500' : 'border-primary-500 bg-primary-500'}"
				></span>
			{/each}
		</div>
		<span class="text-sm opacity-60">
			<strong class={pointsRemaining < 0 ? 'text-red-400' : ''}>{pointsRemaining}</strong>
			/ {ETHIC_BUDGET} ethic points remaining
		</span>
		{#if selected.size > 0}
			<button class="btn preset-filled text-xs" onclick={() => empire.setEthics([])}>
				Clear
			</button>
		{/if}
	</div>

	<!-- Ethics picker -->
	<div class="space-y-2">
		{#each AXES as [leftKey, rightKey] (leftKey)}
			{@const leftEthic = ethicMap.get(leftKey)}
			{@const rightEthic = ethicMap.get(rightKey)}
			{@const leftFanatic = getFanatic(leftKey)}
			{@const rightFanatic = getFanatic(rightKey)}
			{#if leftEthic && rightEthic}
				<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
					<!-- Left side -->
					<div class="flex justify-end gap-1.5">
						{#each ([leftEthic, leftFanatic] as (Ethic | undefined)[]).filter((e): e is Ethic => !!e) as ethic (ethic.key)}
							{@const blocked = isBlocked(ethic!.key)}
							{@const sel = selected.has(ethic!.key)}
							<Tip text={debug ? undefined : ethicTooltip(ethic!)}>
								{#snippet trigger(a)}
									<svelte:element
										this={debug ? 'div' : 'button'}
										{...a}
										class="btn flex-col gap-0.5 text-sm leading-tight
									{sel
											? 'preset-filled-primary-500'
											: blocked
												? 'cursor-not-allowed preset-filled opacity-30'
												: 'preset-filled card-hover'} {debug ? 'cursor-text select-text' : ''}"
										onclick={debug ? undefined : () => toggle(ethic!.key)}
										disabled={debug ? undefined : blocked && !sel}
									>
										<span>{ethicLabel(ethic!)}</span>
										<span class="font-mono text-[10px] opacity-60">{'●'.repeat(ethic!.cost)}</span>
									</svelte:element>
								{/snippet}
							</Tip>
						{/each}
					</div>

					<!-- Axis separator -->
					<span class="text-xs opacity-20 select-none">|</span>

					<!-- Right side -->
					<div class="flex justify-start gap-1.5">
						{#each ([rightEthic, rightFanatic] as (Ethic | undefined)[]).filter((e): e is Ethic => !!e) as ethic (ethic.key)}
							{@const blocked = isBlocked(ethic!.key)}
							{@const sel = selected.has(ethic!.key)}
							<Tip text={debug ? undefined : ethicTooltip(ethic!)}>
								{#snippet trigger(a)}
									<svelte:element
										this={debug ? 'div' : 'button'}
										{...a}
										class="btn flex-col gap-0.5 text-sm leading-tight
									{sel
											? 'preset-filled-primary-500'
											: blocked
												? 'cursor-not-allowed preset-filled opacity-30'
												: 'preset-filled card-hover'} {debug ? 'cursor-text select-text' : ''}"
										onclick={debug ? undefined : () => toggle(ethic!.key)}
										disabled={debug ? undefined : blocked && !sel}
									>
										<span>{ethicLabel(ethic!)}</span>
										<span class="font-mono text-[10px] opacity-60">{'●'.repeat(ethic!.cost)}</span>
									</svelte:element>
								{/snippet}
							</Tip>
						{/each}
					</div>
				</div>
			{/if}
		{/each}

		<!-- Gestalt Consciousness -->
		{#each data.ethics.filter((e: Ethic) => e.gestalt) as gestaltEthic (gestaltEthic.key)}
			{@const sel = selected.has(gestaltEthic.key)}
			<div class="border-surface-400-500/30 flex items-center gap-2 border-t pt-1">
				<span class="w-20 shrink-0 text-right text-xs opacity-40">Gestalt</span>
				<span class="text-xs opacity-20 select-none">|</span>
				<Tip text={debug ? undefined : ethicTooltip(gestaltEthic)}>
					{#snippet trigger(a)}
						<svelte:element
							this={debug ? 'div' : 'button'}
							{...a}
							class="btn flex-col gap-0.5 text-sm leading-tight
						{sel ? 'preset-filled-primary-500' : 'preset-filled card-hover'} {debug
								? 'cursor-text select-text'
								: ''}"
							onclick={debug ? undefined : selectGestalt}
						>
							<span>{ethicLabel(gestaltEthic)}</span>
							<span class="font-mono text-[10px] opacity-60">{'●'.repeat(gestaltEthic.cost)}</span>
						</svelte:element>
					{/snippet}
				</Tip>
			</div>
		{/each}
	</div>

	<!-- Selected ethics effects -->
	{#if selectedEthics.length > 0}
		<section class="space-y-4">
			<h2 class="text-lg font-semibold">
				{selectedEthics.map(ethicLabel).join(' + ')}
			</h2>

			<ul class="max-w-sm space-y-1">
				{#each combinedModifiers as { modifier, sources } (modifier.key)}
					<li class="flex items-baseline justify-between gap-4 text-sm">
						<span class="opacity-70">
							{modLabel(modifier)} <span class="opacity-50">({sources.join(', ')})</span>
						</span>
						<span class="shrink-0 font-mono {valueColor(modifier)}">{formatValue(modifier)}</span>
					</li>
				{/each}
			</ul>

			{#if combinedImplications.length > 0 || selectedPolicyRestrictions.length > 0}
				<div>
					<h3 class="mb-2 text-sm font-medium opacity-60">Gameplay Implications</h3>
					<ul class="max-w-lg space-y-1">
						{#each combinedImplications as { label, sources } (label)}
							<li class="text-sm">
								<span class="opacity-70">{label}</span>
								<span class="text-xs opacity-40"> ({sources.join(', ')})</span>
							</li>
						{/each}
						{#each selectedPolicyRestrictions as { label, sources } (label)}
							<li class="text-sm">
								<span class="opacity-70">{label}</span>
								<span class="text-xs opacity-40"> ({sources.join(', ')})</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	{/if}

	<!-- All effects comparison table -->
	{#if allModifierKeys.length > 0}
		<section>
			<h2 class="mb-3 text-lg font-semibold">Effects by Ethic</h2>
			<div class="max-h-128 overflow-auto">
				<table class="w-full text-xs">
					<thead>
						<tr class="border-surface-400-500/40 border-b">
							<th
								class="sticky top-0 z-10 w-48 py-1.5 pr-4 text-left font-medium opacity-60"
								style="background-color: var(--color-surface-50-950)">Modifier</th
							>
							{#each tableEthicPairs as { regular, fanatic } (regular.key)}
								{@const active =
									selected.has(regular.key) || !!(fanatic && selected.has(fanatic.key))}
								<th
									class="sticky top-0 z-10 px-2 py-1.5 text-center leading-tight font-medium {active
										? 'text-primary-400'
										: 'opacity-60'}"
									style="min-width: 5rem; background-color: var(--color-surface-50-950)"
								>
									{ethicLabel(regular)}
								</th>
							{/each}
						</tr>
						<tr class="border-surface-400-500/20 border-b">
							<th
								class="sticky top-7.5 z-10 pr-4 pb-1 text-left text-[10px] font-normal opacity-30"
								style="background-color: var(--color-surface-50-950)">reg (fanatic)</th
							>
							{#each tableEthicPairs as _, i (i)}<th
									class="sticky top-7.5 z-10"
									style="background-color: var(--color-surface-50-950)"
								></th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each allModifierKeys as modKey (modKey)}
							{@const anyMod = nonGestaltEthics
								.flatMap((e: Ethic) => e.modifiers)
								.find((m: Modifier) => m.key === modKey)}
							<tr class="border-surface-400-500/20 border-b hover:bg-surface-500/10">
								<td class="py-1.5 pr-4 opacity-70">{anyMod ? modLabel(anyMod) : modKey}</td>
								{#each tableEthicPairs as { regular, fanatic } (regular.key)}
									{@const regMod = regular.modifiers.find((m: Modifier) => m.key === modKey)}
									{@const fanMod = fanatic?.modifiers.find((m: Modifier) => m.key === modKey)}
									{@const active =
										selected.has(regular.key) || !!(fanatic && selected.has(fanatic.key))}
									<td class="px-2 py-1.5 text-center font-mono">
										{#if regMod || fanMod}
											{@const displayMod = regMod ?? fanMod!}
											<span class="{valueColor(displayMod)} {active ? 'font-bold' : 'opacity-70'}">
												{regMod ? formatValue(regMod) : '—'}
												{#if fanMod}<span class="opacity-60"> ({formatValue(fanMod)})</span>{/if}
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

	<!-- Gameplay implications reference table -->
	{#if allImplicationTags.length > 0}
		<section>
			<h2 class="mb-3 text-lg font-semibold">Gameplay Implications by Ethic</h2>
			<div class="max-h-128 overflow-auto">
				<table class="w-full text-xs">
					<thead>
						<tr class="border-surface-400-500/40 border-b">
							<th
								class="sticky top-0 z-10 w-64 py-1.5 pr-4 text-left font-medium opacity-60"
								style="background-color: var(--color-surface-50-950)">Implication</th
							>
							{#each tableEthicPairs as { regular, fanatic } (regular.key)}
								{@const active =
									selected.has(regular.key) || !!(fanatic && selected.has(fanatic.key))}
								<th
									class="sticky top-0 z-10 px-2 py-1.5 text-center leading-tight font-medium {active
										? 'text-primary-400'
										: 'opacity-60'}"
									style="min-width: 4.5rem; background-color: var(--color-surface-50-950)"
								>
									{ethicLabel(regular)}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each allImplicationTags as { tag, label } (tag)}
							<tr class="border-surface-400-500/20 border-b hover:bg-surface-500/10">
								<td class="py-1.5 pr-4 leading-tight opacity-70">{label}</td>
								{#each tableEthicPairs as { regular, fanatic } (regular.key)}
									{@const hasReg = regular.implications.some(
										(i: EthicImplication) => i.tag === tag
									)}
									{@const hasFan =
										fanatic?.implications.some((i: EthicImplication) => i.tag === tag) ?? false}
									{@const active =
										selected.has(regular.key) || !!(fanatic && selected.has(fanatic.key))}
									<td class="px-2 py-1.5 text-center text-[11px]">
										{#if hasReg && hasFan}
											<span class={active ? 'font-bold text-primary-400' : 'opacity-60'}>●</span>
										{:else if hasReg}
											<Tip
												text="Regular only"
												class={active ? 'font-bold text-primary-400' : 'opacity-50'}>reg</Tip
											>
										{:else if hasFan}
											<Tip
												text="Fanatic only"
												class={active ? 'font-bold text-primary-400' : 'opacity-50'}>fan</Tip
											>
										{:else}
											<span class="opacity-15">—</span>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
						<!-- Policy-based restrictions (extracted from valid{} blocks in common/policies/*.txt) -->
						{#if allPolicyRestrictions.length > 0}
							<tr class="border-surface-400-500/40 border-b">
								<td
									colspan={1 + tableEthicPairs.length}
									class="py-1 pr-4 text-[10px] italic opacity-30"
								>
									Policy restrictions
								</td>
							</tr>
							{#each allPolicyRestrictions as pr (pr.policyKey + pr.optionKey)}
								<tr class="border-surface-400-500/20 border-b hover:bg-surface-500/10">
									<td class="py-1.5 pr-4 leading-tight opacity-70"
										><Tip text="{pr.policyKey} policy">{pr.label}</Tip></td
									>
									{#each tableEthicPairs as { regular, fanatic } (regular.key)}
										{@const hasReg = regular.policyRestrictions.some(
											(r: PolicyRestriction) =>
												r.policyKey === pr.policyKey && r.optionKey === pr.optionKey
										)}
										{@const hasFan =
											fanatic?.policyRestrictions.some(
												(r: PolicyRestriction) =>
													r.policyKey === pr.policyKey && r.optionKey === pr.optionKey
											) ?? false}
										{@const active =
											selected.has(regular.key) || !!(fanatic && selected.has(fanatic.key))}
										<td class="px-2 py-1.5 text-center text-[11px]">
											{#if hasReg && hasFan}
												<span class={active ? 'font-bold text-primary-400' : 'opacity-60'}>●</span>
											{:else if hasReg}
												<Tip
													text="Regular only"
													class={active ? 'font-bold text-primary-400' : 'opacity-50'}>reg</Tip
												>
											{:else if hasFan}
												<Tip
													text="Fanatic only"
													class={active ? 'font-bold text-primary-400' : 'opacity-50'}>fan</Tip
												>
											{:else}
												<span class="opacity-15">—</span>
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
			{#if gestaltImplications.length > 0}
				<div class="mt-3 text-xs opacity-60">
					<span class="font-medium">Gestalt Consciousness:</span>
					{gestaltImplications.map((i: EthicImplication) => i.label).join(' · ')}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Monument bonuses per 100 civilians -->
	<section>
		<h2 class="mb-1 text-lg font-semibold">Monument Bonuses per 100 Civilians</h2>
		<p class="mb-4 text-sm opacity-50">
			All monument buildings apply these per-100-civilian bonuses based on the empire's governing
			ethics.
		</p>
		<div class="max-h-128 overflow-auto">
			<table class="w-full text-xs">
				<thead>
					<tr class="border-surface-400-500/40 border-b">
						<th
							class="sticky top-0 z-10 w-40 py-1.5 pr-4 text-left font-medium opacity-60"
							style="background-color: var(--color-surface-50-950)">Ethic</th
						>
						<th
							class="sticky top-0 z-10 px-3 py-1.5 text-left font-medium opacity-60"
							style="background-color: var(--color-surface-50-950)">Effect</th
						>
						<th
							class="sticky top-0 z-10 px-3 py-1.5 text-center font-medium opacity-60"
							style="background-color: var(--color-surface-50-950)">Regular</th
						>
						<th
							class="sticky top-0 z-10 px-3 py-1.5 text-center font-medium opacity-60"
							style="background-color: var(--color-surface-50-950)">Fanatic</th
						>
					</tr>
				</thead>
				<tbody>
					{#each MONUMENT_BONUSES as { ethicKey, rows } (ethicKey)}
						{@const ethic = ethicMap.get(ethicKey)}
						{@const active =
							selected.has(ethicKey) ||
							!!(ethic?.regular_variant && selected.has(ethic.regular_variant)) ||
							!!(ethic?.fanatic_variant && selected.has(ethic.fanatic_variant))}
						{#each rows as row, i (row.label)}
							<tr class="border-surface-400-500/20 border-b hover:bg-surface-500/10">
								{#if i === 0}
									<td
										class="py-1.5 pr-4 font-medium {active ? 'text-primary-400' : 'opacity-70'}"
										rowspan={rows.length}
									>
										{ethic ? ethicLabel(ethic) : ethicKey}
									</td>
								{/if}
								<td class="px-3 py-1.5 opacity-70">{row.label}</td>
								<td
									class="px-3 py-1.5 text-center font-mono {row.good
										? 'text-emerald-400'
										: 'text-red-400'} {active ? '' : 'opacity-70'}">{row.regular}</td
								>
								<td
									class="px-3 py-1.5 text-center font-mono {row.fanatic
										? row.good
											? 'text-emerald-400'
											: 'text-red-400'
										: 'opacity-20'} {active ? '' : 'opacity-70'}"
								>
									{row.fanatic ?? '—'}
								</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</main>
