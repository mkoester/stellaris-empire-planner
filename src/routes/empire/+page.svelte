<script lang="ts">
	import type { PageData } from './$types';
	import type { Empire } from '$lib/server/db';
	import { empire } from '$lib/empire.svelte';
	import { parseEmpireFile, keyName, shipTypeLabel } from '$lib/empireFile';

	let { data }: { data: PageData } = $props();
	const predefined = $derived(data.predefined as Empire[]);
	const names = $derived(data.names as Record<string, string>);

	const name = (key: string | null) => keyName(key, names);

	let importKey = $state('');
	function importPredefined() {
		const e = predefined.find((p) => p.key === importKey);
		if (e) empire.load(e);
	}

	// Empires parsed from an uploaded file (pick one if the file holds several).
	let fileEmpires = $state<Empire[]>([]);
	let fileError = $state('');
	async function onFile(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		fileError = '';
		try {
			const parsed = parseEmpireFile(await file.text());
			if (parsed.length === 0) {
				fileError = 'No empires found in that file.';
				fileEmpires = [];
			} else if (parsed.length === 1) {
				fileEmpires = [];
				empire.load(parsed[0]);
			} else {
				fileEmpires = parsed; // let the user pick
			}
		} catch {
			fileError = 'Could not parse that file.';
		}
	}

	const current = $derived(empire.current);
</script>

<main class="mx-auto max-w-5xl space-y-6 p-4">
	<h1 class="text-2xl font-bold">Empire</h1>
	<p class="max-w-3xl text-sm opacity-60">
		Import a predefined empire or load a <code>user_empire_designs.txt</code> as a starting point. (Editing
		and exporting come next.)
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
					<button
						class="btn preset-filled text-sm card-hover"
						onclick={() => {
							empire.load(e);
							fileEmpires = [];
						}}>{e.name}</button
					>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Current empire -->
	{#if current}
		{@const rows = [
			{ label: 'Species', value: name(current.speciesClass) },
			{ label: 'Authority', value: name(current.authority) },
			{ label: 'Origin', value: name(current.origin) },
			{ label: 'Homeworld', value: name(current.planetClass) },
			{ label: 'Ship type', value: shipTypeLabel(current.graphicalCulture) }
		]}
		<section class="border-surface-400-500/30 space-y-4 rounded-lg border p-4">
			<div class="flex items-baseline justify-between gap-3">
				<h2 class="text-xl font-semibold">{current.name}</h2>
				<span class="text-[11px] opacity-40"
					>{current.source === 'predefined' ? 'predefined' : 'from file'}</span
				>
			</div>

			<dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
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

			{@render chips('Ethics', current.ethics, 'bg-primary-500/15 text-primary-300/90')}
			{@render chips('Civics', current.civics, 'bg-sky-500/15 text-sky-300/90')}
			{@render chips('Traits', current.traits, 'bg-emerald-500/15 text-emerald-300/90')}
		</section>
	{:else}
		<p class="text-sm opacity-50">No empire loaded yet.</p>
	{/if}
</main>
