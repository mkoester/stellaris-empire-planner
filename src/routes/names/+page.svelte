<script lang="ts">
	import { empire } from '$lib/empire.svelte';
	import type { NameField } from '$lib/empire.svelte';

	const draft = $derived(empire.draft);

	// The naming form, grouped the way the in-game empire creator presents them.
	type Field = { id: NameField; label: string; placeholder: string };
	const groups: { title: string; hint?: string; fields: Field[] }[] = [
		{
			title: 'Empire',
			fields: [
				{ id: 'name', label: 'Name', placeholder: 'United Nations of Earth' },
				{ id: 'adjective', label: 'Adjective', placeholder: 'Human' },
				{ id: 'shipPrefix', label: 'Ship prefix', placeholder: 'UNS' }
			]
		},
		{
			title: 'Species',
			hint: 'Singular, plural and adjective forms — used throughout events and tooltips.',
			fields: [
				{ id: 'speciesName', label: 'Name', placeholder: 'Human' },
				{ id: 'speciesPlural', label: 'Plural', placeholder: 'Humans' },
				{ id: 'speciesAdjective', label: 'Adjective', placeholder: 'Human' }
			]
		},
		{
			title: 'Ruler',
			fields: [{ id: 'rulerName', label: 'Name', placeholder: 'Lord Commander' }]
		},
		{
			title: 'Homeworld',
			fields: [
				{ id: 'planetName', label: 'Planet', placeholder: 'Earth' },
				{ id: 'systemName', label: 'System / star', placeholder: 'Sol' }
			]
		}
	];
</script>

<main class="mx-auto max-w-3xl space-y-6 p-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Names</h1>
		<p class="text-sm opacity-60">
			The names you'd type at empire creation. Loading a predefined empire or a
			<code>user_empire_designs.txt</code> fills these in.
		</p>
	</div>

	<form class="space-y-5" onsubmit={(e) => e.preventDefault()}>
		{#each groups as group (group.title)}
			<section class="border-surface-400-500/30 space-y-3 rounded-lg border p-4">
				<div>
					<h2 class="text-lg font-semibold">{group.title}</h2>
					{#if group.hint}<p class="text-xs opacity-50">{group.hint}</p>{/if}
				</div>
				<div class="grid gap-3 sm:grid-cols-3">
					{#each group.fields as field (field.id)}
						<label class="flex flex-col gap-1 text-sm">
							<span class="opacity-60">{field.label}</span>
							<input
								class="input"
								type="text"
								placeholder={field.placeholder}
								value={draft[field.id]}
								oninput={(e) => empire.setName(field.id, e.currentTarget.value)}
							/>
						</label>
					{/each}
				</div>
			</section>
		{/each}
	</form>
</main>
