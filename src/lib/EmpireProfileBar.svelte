<script lang="ts">
	// The global filter bar of the Tradition Trees and Ascension Perks pages: an empire
	// profile (shared via settings), "from planned empire", "show unavailable", and search.
	import ProfileChips from '$lib/ProfileChips.svelte';
	import Tip from '$lib/Tip.svelte';
	import { empire } from '$lib/empire.svelte';
	import { settings } from '$lib/settings.svelte';
	import { ANY_PROFILE, isActive, profileFromDraft } from '$lib/triggers';

	let {
		query = $bindable(''),
		archetypeOf,
		nomadicOrigins,
		placeholder = 'Search names and effects…',
		anyHint = ''
	}: {
		query?: string;
		archetypeOf: Record<string, string | null>;
		nomadicOrigins: string[];
		placeholder?: string;
		anyHint?: string; // shown while no filter is set
	} = $props();

	const profile = $derived(settings.empireProfile);
	const fromPlan = $derived(profile.civics !== undefined);
	const draftEmpty = $derived(empire.draft.authority === null && empire.draft.origin === null);
</script>

<div class="border-surface-400-500/30 space-y-2 rounded-lg border p-3">
	<div class="flex flex-wrap items-center gap-2">
		<span class="text-xs opacity-60">Empire type:</span>
		<button
			class="rounded px-2.5 py-1 text-xs {isActive(profile)
				? 'preset-tonal hover:preset-filled-surface-500'
				: 'preset-filled-primary-500'}"
			onclick={() => (settings.empireProfile = ANY_PROFILE)}
		>
			Any
		</button>
		<ProfileChips
			{profile}
			onchange={(p) =>
				(settings.empireProfile = {
					...p,
					ethics: undefined,
					civics: undefined,
					origin: undefined
				})}
		/>
		<Tip
			text={draftEmpty
				? 'Choose a government and origin in the planner first'
				: 'Use the empire you are planning: its authority, origin, civics and ethics'}
		>
			{#snippet trigger(a)}
				<button
					{...a}
					disabled={draftEmpty}
					class="rounded px-2.5 py-1 text-xs disabled:opacity-40 {fromPlan
						? 'preset-filled-primary-500'
						: 'preset-tonal hover:preset-filled-surface-500'}"
					onclick={() =>
						(settings.empireProfile = profileFromDraft(empire.draft, archetypeOf, nomadicOrigins))}
				>
					↺ From planned empire
				</button>
			{/snippet}
		</Tip>
	</div>
	<div class="flex flex-wrap items-center gap-3">
		<input class="input max-w-sm text-sm" type="search" {placeholder} bind:value={query} />
		<label class="flex items-center gap-1.5 text-xs opacity-70">
			<input
				type="checkbox"
				class="checkbox"
				checked={settings.showUnavailable}
				disabled={!isActive(profile)}
				onchange={() => settings.toggleShowUnavailable()}
			/>
			Show what this empire can't take (greyed out)
		</label>
		{#if anyHint && !isActive(profile)}
			<span class="text-xs opacity-50">{anyHint}</span>
		{/if}
	</div>
</div>
