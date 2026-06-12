<script lang="ts">
	import type { PageData } from './$types';
	import type { Empire, ModifierSource } from '$lib/server/db';
	import { empire } from '$lib/empire.svelte';
	import { parseEmpireFile, keyName, shipTypeLabel } from '$lib/empireFile';
	import { collectEffects, collectSpeciesEffects, groupEffects } from '$lib/effects';
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';

	let { data }: { data: PageData } = $props();
	const predefined = $derived(data.predefined as Empire[]);
	const names = $derived(data.names as Record<string, string>);
	const modifierIndex = $derived(data.modifierIndex as Record<string, ModifierSource>);
	const name = (key: string | null) => keyName(key, names);

	let importKey = $state('');
	let fileEmpires = $state<Empire[]>([]); // when an uploaded file holds several
	let fileError = $state('');
	let pending = $state<Empire | null>(null); // awaiting an override decision

	// Reset the import controls after a load completes (or is cancelled).
	function resetControls() {
		importKey = '';
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

	function importPredefined() {
		const e = predefined.find((p) => p.key === importKey);
		if (e) tryLoad(e);
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
	// Species traits, grouped per species (one founder species for now, but the model
	// supports several — e.g. Syncretic Evolution).
	const speciesGroups = $derived(
		collectSpeciesEffects(
			[
				{
					name: draft.speciesClass ? name(draft.speciesClass) : 'Founder species',
					traits: draft.traits
				}
			],
			modifierIndex,
			names
		)
	);
</script>

<main class="mx-auto max-w-5xl space-y-6 p-4">
	<h1 class="text-2xl font-bold">Empire</h1>
	<p class="max-w-3xl text-sm opacity-60">
		Import a predefined empire or load a <code>user_empire_designs.txt</code> as a starting point — it
		populates the builder sections (Ethics, Species Builder, …). Editing and export come next.
	</p>

	<!-- Import / load controls -->
	<div class="border-surface-400-500/30 flex flex-wrap items-end gap-4 rounded-lg border p-4">
		<label class="flex flex-col gap-1 text-sm">
			<span class="opacity-60">Predefined empire</span>
			<span class="flex gap-2">
				<select class="select" bind:value={importKey}>
					<option value="" disabled>Choose…</option>
					{#each predefined as p (p.key)}
						<option value={p.key}>{p.name}</option>
					{/each}
				</select>
				<button
					class="btn preset-filled-primary-500"
					disabled={!importKey}
					onclick={importPredefined}
				>
					Import
				</button>
			</span>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span class="opacity-60">Load empire file</span>
			<input class="input" type="file" accept=".txt" onchange={onFile} />
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
			{ label: 'Origin', value: name(draft.origin) },
			{ label: 'Homeworld', value: name(draft.planetClass) },
			{ label: 'Ship type', value: shipTypeLabel(draft.graphicalCulture) }
		]}
		<section class="border-surface-400-500/30 space-y-4 rounded-lg border p-4">
			<h2 class="text-xl font-semibold">{draft.name || 'Current empire'}</h2>

			<dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
				{#each rows as r (r.label)}
					<div class="flex flex-col">
						<dt class="text-[11px] uppercase opacity-40">{r.label}</dt>
						<dd>{r.value}</dd>
					</div>
				{/each}
			</dl>

			{#snippet chips(label: string, keys: string[], cls: string)}
				{#if keys.length}
					<div>
						<div class="mb-1 text-[11px] uppercase opacity-40">{label}</div>
						<div class="flex flex-wrap gap-1.5">
							{#each keys as k (k)}
								<span class="rounded px-1.5 py-0.5 text-xs {cls}">{name(k)}</span>
							{/each}
						</div>
					</div>
				{/if}
			{/snippet}

			{@render chips('Ethics', draft.ethics, 'bg-primary-500/15 text-primary-300/90')}
			{@render chips('Civics', draft.civics, 'bg-sky-500/15 text-sky-300/90')}
			{@render chips('Traits', draft.traits, 'bg-emerald-500/15 text-emerald-300/90')}
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
	{:else}
		<p class="text-sm opacity-50">No empire loaded yet.</p>
	{/if}
</main>
