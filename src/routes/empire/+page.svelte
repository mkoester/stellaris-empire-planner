<script lang="ts">
	import type { PageData } from './$types';
	import type { Empire, ModifierSource, Ethic, Civic, Origin } from '$lib/server/db';
	import { empire } from '$lib/empire.svelte';
	import { parseEmpireFile, serializeEmpire, keyName, shipTypeLabel } from '$lib/empireFile';
	import { collectEffects, collectSpeciesEffects, groupEffects } from '$lib/effects';
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';
	import { combineImplications, combinePolicyRestrictions, MONUMENT_BONUSES } from '$lib/ethics';
	import RuleText from '$lib/RuleText.svelte';
	import LockIcon from '$lib/LockIcon.svelte';

	let { data }: { data: PageData } = $props();
	const predefined = $derived(data.predefined as Empire[]);
	const names = $derived(data.names as Record<string, string>);
	const modifierIndex = $derived(data.modifierIndex as Record<string, ModifierSource>);
	const name = (key: string | null) => keyName(key, names);

	let filter = $state(''); // predefined-empire table search
	let showPicker = $state(false); // the predefined-empire table is toggled open/closed
	let fileEmpires = $state<Empire[]>([]); // when an uploaded file holds several
	let fileError = $state('');
	let pending = $state<Empire | null>(null); // awaiting an override decision
	let confirmReset = $state(false); // two-step "reset everything" confirmation

	// A predefined empire's display name (the machine-age DLC alternates share a base name).
	const empireLabel = (p: Empire) =>
		`${p.name}${p.key.endsWith('_machine_age') ? ' (Machine Age)' : ''}`;
	const speciesOf = (p: Empire) => p.speciesName || name(p.speciesClass);

	const filteredPredefined = $derived.by(() => {
		const q = filter.trim().toLowerCase();
		if (!q) return predefined;
		return predefined.filter((p) =>
			`${empireLabel(p)} ${name(p.origin)} ${speciesOf(p)} ${p.ethics
				.map(name)
				.join(' ')} ${p.civics.map(name).join(' ')}`
				.toLowerCase()
				.includes(q)
		);
	});

	function resetEmpire() {
		empire.reset();
		confirmReset = false;
		resetControls();
	}

	// Reset the import controls after a load completes (or is cancelled).
	function resetControls() {
		fileEmpires = [];
	}

	// Single entry point for loading an empire: prompt about overrides only if some
	// sections already hold a value, otherwise just load everything.
	function tryLoad(e: Empire) {
		if (empire.anySet()) {
			pending = e;
		} else {
			empire.apply(e, 'all');
			resetControls();
		}
	}
	function resolve(mode: 'all' | 'partial') {
		if (pending) empire.apply(pending, mode);
		pending = null;
		resetControls();
	}
	function cancel() {
		pending = null;
		resetControls();
	}

	// Download the current draft as a single-empire .stellaris-empire file (game format).
	function saveEmpire() {
		const d = empire.draft;
		const text = serializeEmpire(empire.toSerializable(), d.name || 'empire');
		const base = (d.name || 'empire').trim().replace(/[^\w-]+/g, '_') || 'empire';
		const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${base}.stellaris-empire`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	async function onFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		fileError = '';
		try {
			const parsed = parseEmpireFile(await file.text());
			if (parsed.length === 0) fileError = 'No empires found in that file.';
			else if (parsed.length === 1) tryLoad(parsed[0]);
			else fileEmpires = parsed; // let the user pick one
		} catch {
			fileError = 'Could not parse that file.';
		}
		input.value = ''; // allow re-selecting the same file
	}

	const draft = $derived(empire.draft);
	const hasEmpire = $derived(empire.anySet());
	const effectGroups = $derived(groupEffects(collectEffects(draft, modifierIndex, names)));

	// ── Gameplay block: ethic implications + civic/origin effect descriptions ────
	const ethics = $derived(data.ethics as Ethic[]);
	const civics = $derived(data.civics as Civic[]);
	const origins = $derived(data.origins as Origin[]);

	// Civics that can't be added/removed after game start — marked with a lock icon.
	const lockedCivics = $derived(new Set(civics.filter((c) => c.locked).map((c) => c.key)));

	// An origin can force the starting world (Shattered Ring → Ring Segment, …) and/or a
	// fixed home system, overriding what was picked on the Planets page.
	const selectedOrigin = $derived(origins.find((o) => o.key === draft.origin) ?? null);
	const forcedWorld = $derived(selectedOrigin?.startingColony ?? null);
	const forcesSystem = $derived(selectedOrigin?.forcesHomeSystem ?? false);

	const ethicMap = $derived(new Map(ethics.map((e) => [e.key, e])));
	const selectedEthics = $derived(ethics.filter((e) => draft.ethics.includes(e.key)));
	const implications = $derived(combineImplications(selectedEthics));
	const policyRestrictions = $derived(combinePolicyRestrictions(selectedEthics));

	// "Gameplay effects" = the cleaned rule descriptions of the chosen civics + origin.
	const gameplayEffects = $derived([
		...civics
			.filter((c) => draft.civics.includes(c.key) && c.description)
			.map((c) => ({ kind: 'civic', name: c.name ?? c.key, description: c.description! })),
		...origins
			.filter((o) => o.key === draft.origin && o.description)
			.map((o) => ({ kind: 'origin', name: o.name ?? o.key, description: o.description! }))
	]);

	// Monument bonuses for exactly the ethics this empire holds (regular vs fanatic).
	const monumentRows = $derived.by(() => {
		const out: { ethic: string; effect: string; value: string; good: boolean; fanatic: boolean }[] =
			[];
		for (const { ethicKey, rows } of MONUMENT_BONUSES) {
			const e = ethicMap.get(ethicKey);
			const hasFanatic = !!(e?.fanatic_variant && draft.ethics.includes(e.fanatic_variant));
			const hasRegular =
				draft.ethics.includes(ethicKey) ||
				!!(e?.regular_variant && draft.ethics.includes(e.regular_variant));
			if (!hasFanatic && !hasRegular) continue;
			const ethicName = e?.label ?? ethicKey;
			for (const row of rows) {
				out.push({
					ethic: ethicName,
					effect: row.label,
					value: hasFanatic ? (row.fanatic ?? row.regular) : row.regular,
					good: row.good,
					fanatic: hasFanatic
				});
			}
		}
		return out;
	});
	// Species traits, grouped per species — the founder plus an optional secondary
	// founding species (Syncretic Evolution / Necrophage / …).
	const speciesGroups = $derived(
		collectSpeciesEffects(
			[
				{
					name:
						draft.speciesName ||
						(draft.speciesClass ? name(draft.speciesClass) : 'Founder species'),
					traits: draft.traits
				},
				...(draft.secondary
					? [
							{
								name:
									draft.secondary.speciesName ||
									(draft.secondary.speciesClass
										? name(draft.secondary.speciesClass)
										: 'Secondary species'),
								traits: draft.secondary.traits
							}
						]
					: [])
			],
			modifierIndex,
			names
		)
	);
</script>

<main class="mx-auto max-w-5xl space-y-6 p-4">
	<h1 class="text-2xl font-bold">Empire</h1>
	<p class="max-w-3xl text-sm opacity-60">
		Import a predefined empire or load a <code>user_empire_designs.txt</code> as a starting point —
		it populates the builder sections (Ethics, Species Builder, …). Save the current empire back out
		as a single-empire <code>.stellaris-empire</code> file below.
	</p>

	<!-- Import / load controls -->
	<div class="border-surface-400-500/30 space-y-4 rounded-lg border p-4">
		<div class="space-y-2">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<button
					class="btn text-sm {showPicker ? 'preset-filled' : 'preset-filled-primary-500'}"
					onclick={() => (showPicker = !showPicker)}
				>
					{showPicker ? 'Hide predefined empires' : 'Choose a predefined empire'}
				</button>
				{#if showPicker}
					<input
						class="input max-w-xs text-sm"
						type="search"
						placeholder="Filter empires…"
						bind:value={filter}
					/>
				{/if}
			</div>
			{#if showPicker}
				<p class="text-xs opacity-50">Click a row to import.</p>
				<div class="border-surface-400-500/30 max-h-96 overflow-auto rounded border">
					<table class="w-full text-left text-xs">
						<thead
							class="sticky top-0 z-10 bg-surface-50-950/95 backdrop-blur"
							style="background-color: var(--color-surface-50-950)"
						>
							<tr class="border-surface-400-500/40 border-b">
								<th class="px-2 py-1.5 font-medium opacity-60">Name</th>
								<th class="px-2 py-1.5 font-medium opacity-60">Origin</th>
								<th class="px-2 py-1.5 font-medium opacity-60">Species</th>
								<th class="px-2 py-1.5 font-medium opacity-60">Ethics</th>
								<th class="px-2 py-1.5 font-medium opacity-60">Civics</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredPredefined as p (p.key)}
								<tr
									class="border-surface-400-500/20 cursor-pointer border-b align-top hover:bg-primary-500/10"
									onclick={() => {
										tryLoad(p);
										showPicker = false;
									}}
								>
									<td class="px-2 py-1.5 font-medium whitespace-nowrap">{empireLabel(p)}</td>
									<td class="px-2 py-1.5 opacity-80">{name(p.origin)}</td>
									<td class="px-2 py-1.5 opacity-80">{speciesOf(p)}</td>
									<td class="px-2 py-1.5 opacity-70">{p.ethics.map(name).join(', ')}</td>
									<td class="px-2 py-1.5 opacity-70">{p.civics.map(name).join(', ')}</td>
								</tr>
							{/each}
							{#if filteredPredefined.length === 0}
								<tr
									><td class="px-2 py-3 opacity-50" colspan="5">No empires match “{filter}”.</td
									></tr
								>
							{/if}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<label class="flex max-w-md flex-col gap-1 text-sm">
			<span class="opacity-60">Load empire file</span>
			<input class="input" type="file" accept=".txt,.stellaris-empire" onchange={onFile} />
		</label>
	</div>

	{#if fileError}<p class="text-sm text-red-400">{fileError}</p>{/if}

	{#if fileEmpires.length > 1}
		<div class="space-y-2">
			<p class="text-sm opacity-60">That file holds {fileEmpires.length} empires — pick one:</p>
			<div class="flex flex-wrap gap-2">
				{#each fileEmpires as e (e.key)}
					<button class="btn preset-filled text-sm card-hover" onclick={() => tryLoad(e)}
						>{e.name}</button
					>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Override prompt (only when sections already hold values) -->
	{#if pending}
		<div class="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
			<p class="text-sm">
				Some sections already have selections (<span class="opacity-70"
					>{empire.setSectionLabels().join(', ')}</span
				>). How should <strong>{pending.name}</strong> be applied?
			</p>
			<div class="flex flex-wrap gap-2">
				<button class="btn preset-filled-primary-500 text-sm" onclick={() => resolve('all')}>
					Override everything
				</button>
				<button class="btn preset-filled text-sm" onclick={() => resolve('partial')}>
					Only fill empty sections
				</button>
				<button class="btn preset-filled text-sm opacity-70" onclick={cancel}>Cancel</button>
			</div>
		</div>
	{/if}

	<!-- Current empire -->
	{#if hasEmpire}
		{@const rows = [
			{ label: 'Species', value: name(draft.speciesClass) },
			...(draft.secondary
				? [
						{
							label: 'Secondary species',
							value: draft.secondary.speciesName || name(draft.secondary.speciesClass)
						}
					]
				: []),
			{ label: 'Government', value: name(draft.authority) },
			{ label: 'Origin', value: name(draft.origin) },
			{
				label: 'Homeworld',
				value: forcedWorld ? `${name(forcedWorld)} (forced by origin)` : name(draft.planetClass)
			},
			...(forcesSystem
				? [{ label: 'Home system', value: 'Set by origin' }]
				: draft.initializer
					? [{ label: 'Home system', value: name(draft.initializer) }]
					: []),
			{ label: 'Ship type', value: shipTypeLabel(draft.graphicalCulture) }
		]}
		<section class="border-surface-400-500/30 space-y-4 rounded-lg border p-4">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-xl font-semibold">{draft.name || 'Current empire'}</h2>
				<div class="flex flex-wrap items-center gap-2">
					<button class="btn preset-filled-primary-500 text-sm" onclick={saveEmpire}>
						Save .stellaris-empire
					</button>
					{#if confirmReset}
						<span class="text-sm opacity-70">Reset everything?</span>
						<button
							class="btn border border-red-500/50 text-sm text-red-300 hover:bg-red-500/10"
							onclick={resetEmpire}
						>
							Yes, reset
						</button>
						<button
							class="btn preset-filled text-sm opacity-70"
							onclick={() => (confirmReset = false)}
						>
							Cancel
						</button>
					{:else}
						<button class="btn preset-filled text-sm" onclick={() => (confirmReset = true)}>
							Reset all
						</button>
					{/if}
				</div>
			</div>

			<dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
				{#each rows as r (r.label)}
					<div class="flex flex-col">
						<dt class="text-[11px] uppercase opacity-40">{r.label}</dt>
						<dd>{r.value}</dd>
					</div>
				{/each}
			</dl>

			{#snippet chips(label: string, keys: string[], cls: string, locked?: Set<string>)}
				{#if keys.length}
					<div>
						<div class="mb-1 text-[11px] uppercase opacity-40">{label}</div>
						<div class="flex flex-wrap gap-1.5">
							{#each keys as k (k)}
								<span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs {cls}">
									{name(k)}{#if locked?.has(k)}<LockIcon size={11} />{/if}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			{/snippet}

			{@render chips('Ethics', draft.ethics, 'bg-primary-500/15 text-primary-300/90')}
			{@render chips('Civics', draft.civics, 'bg-sky-500/15 text-sky-300/90', lockedCivics)}
			{@render chips('Traits', draft.traits, 'bg-emerald-500/15 text-emerald-300/90')}
			{#if draft.secondary}
				{@render chips(
					'Secondary species traits',
					draft.secondary.traits,
					'bg-emerald-500/15 text-emerald-300/90'
				)}
			{/if}
		</section>

		<!-- Aggregated numeric effects of the current choices, grouped by theme -->
		{#if effectGroups.length}
			<section class="border-surface-400-500/30 space-y-4 rounded-lg border p-4">
				<h2 class="text-xl font-semibold">Effects</h2>
				{#each effectGroups as group (group.label)}
					<div class="space-y-1">
						<h3 class="text-xs font-semibold tracking-wide uppercase opacity-50">
							{group.label}
							<span class="font-normal opacity-60">· {group.entries.length}</span>
						</h3>
						{#each group.entries as e, i (i)}
							<div class="flex items-baseline gap-3 text-sm">
								<span class="flex-1">
									{modifierLabel(e.mod)}
									<span class="opacity-45">(from {e.sourceKind} {e.sourceName})</span>
								</span>
								<span class="shrink-0 text-right font-medium tabular-nums {modifierColor(e.mod)}">
									{formatModifierValue(e.mod)}
								</span>
							</div>
						{/each}
					</div>
				{/each}
			</section>
		{/if}

		<!-- Species traits, kept separate and grouped per species -->
		{#if speciesGroups.length}
			<section class="border-surface-400-500/30 space-y-4 rounded-lg border p-4">
				<h2 class="text-xl font-semibold">Species traits</h2>
				{#each speciesGroups as sg (sg.species)}
					<div class="space-y-1">
						<h3 class="text-xs font-semibold tracking-wide uppercase opacity-50">
							{sg.species}
							<span class="font-normal opacity-60">· {sg.entries.length}</span>
						</h3>
						{#each sg.entries as e, i (i)}
							<div class="flex items-baseline gap-3 text-sm">
								<span class="flex-1">
									{modifierLabel(e.mod)}
									<span class="opacity-45">(from trait {e.sourceName})</span>
								</span>
								<span class="shrink-0 text-right font-medium tabular-nums {modifierColor(e.mod)}">
									{formatModifierValue(e.mod)}
								</span>
							</div>
						{/each}
					</div>
				{/each}
			</section>
		{/if}

		<!-- Gameplay: ethic implications + civic/origin effect descriptions, with sources -->
		{#if implications.length || policyRestrictions.length || gameplayEffects.length}
			<section class="border-surface-400-500/30 space-y-4 rounded-lg border p-4">
				<h2 class="text-xl font-semibold">Gameplay</h2>

				{#if implications.length || policyRestrictions.length}
					<div class="space-y-1">
						<h3 class="text-xs font-semibold tracking-wide uppercase opacity-50">
							Gameplay Implications <span class="font-normal opacity-60">(from ethics)</span>
						</h3>
						<ul class="space-y-1">
							{#each implications as imp, i (i)}
								<li class="text-sm">
									<span class="opacity-80">{imp.label}</span>
									<span class="text-xs opacity-45"> (from {imp.sources.join(', ')})</span>
								</li>
							{/each}
							{#each policyRestrictions as pr, i (i)}
								<li class="text-sm">
									<span class="opacity-80">{pr.label}</span>
									<span class="text-xs opacity-45"> (from {pr.sources.join(', ')})</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if gameplayEffects.length}
					<div class="space-y-3">
						<h3 class="text-xs font-semibold tracking-wide uppercase opacity-50">
							Gameplay Effects <span class="font-normal opacity-60"
								>(from civics &amp; origins)</span
							>
						</h3>
						{#each gameplayEffects as eff (eff.kind + eff.name)}
							<div class="space-y-0.5">
								<div class="text-sm font-medium">
									{eff.name}
									<span class="text-xs font-normal opacity-45">({eff.kind})</span>
								</div>
								<RuleText text={eff.description} class="text-xs opacity-60" />
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- Monument bonuses per 100 civilians, from the empire's ethics -->
		{#if monumentRows.length}
			<section class="border-surface-400-500/30 space-y-3 rounded-lg border p-4">
				<h2 class="text-xl font-semibold">Monument Bonuses per 100 Civilians</h2>
				<p class="text-sm opacity-50">
					Monument buildings grant these per-100-civilian bonuses based on the empire's ethics.
				</p>
				<table class="w-full text-sm">
					<thead>
						<tr class="border-surface-400-500/40 border-b text-left">
							<th class="py-1.5 pr-4 font-medium opacity-60">Ethic</th>
							<th class="py-1.5 pr-4 font-medium opacity-60">Effect</th>
							<th class="py-1.5 text-right font-medium opacity-60">Per 100</th>
						</tr>
					</thead>
					<tbody>
						{#each monumentRows as row, i (i)}
							<tr class="border-surface-400-500/20 border-b">
								<td class="py-1.5 pr-4">
									{row.ethic}
									{#if row.fanatic}<span class="text-xs opacity-40">(fanatic)</span>{/if}
								</td>
								<td class="py-1.5 pr-4 opacity-70">{row.effect}</td>
								<td
									class="py-1.5 text-right font-mono {row.good
										? 'text-emerald-400'
										: 'text-red-400'}">{row.value}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
	{:else}
		<p class="text-sm opacity-50">No empire loaded yet.</p>
	{/if}
</main>
