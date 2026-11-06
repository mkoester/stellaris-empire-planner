<script lang="ts">
	// "Help me choose": the helpers that compare picks side by side, across the builder pages —
	// each a folded table, picking from it as on the page it belongs to.
	import type { PageData } from './$types';
	import type { Civic } from '#lib/server/db/index.ts';
	import CouncilSeatTable from '#lib/CouncilSeatTable.svelte';
	import OwnedBuildingTable from '#lib/OwnedBuildingTable.svelte';
	import UnlockTable from '#lib/UnlockTable.svelte';
	import type { Pick } from '#lib/unlocks.ts';
	import { compatChecker } from '#lib/compat.ts';
	import { empire } from '#lib/empire.svelte.ts';

	let { data }: { data: PageData } = $props();
	const compat = $derived(compatChecker(empire.draft, data));
	const civics = $derived(data.civics as Civic[]);
	const isPicked = (p: Pick) =>
		p.kind === 'civic'
			? empire.draft.civics.includes(p.key)
			: (p.kind === 'origin' ? empire.draft.origin : empire.draft.authority) === p.key;
	function togglePick(p: Pick) {
		const on = isPicked(p);
		if (p.kind === 'civic') empire.toggleCivic(p.key);
		else if (p.kind === 'origin') empire.setOrigin(on ? null : p.key);
		else empire.setAuthority(on ? null : p.key);
	}
	const corporate = $derived(empire.draft.authority === 'auth_corporate');
</script>

<main class="mx-auto max-w-7xl space-y-4 p-4">
	<h1 class="text-2xl font-bold">Help me choose</h1>
	<p class="text-sm opacity-60">
		Picks compared side by side by what they lead to. Picking here picks for your empire, as on its
		own page.
	</p>

	<CouncilSeatTable
		{civics}
		council={data.council}
		selected={empire.draft.civics}
		reasons={(k) => compat.reasons('civic', k)}
		ontoggle={(k) => empire.toggleCivic(k)}
	/>
	<OwnedBuildingTable
		title="Branch offices"
		note={corporate
			? 'what each building gives the colony and your capital, and the civics that add to them'
			: 'a MegaCorp’s buildings on other empires’ colonies, and the civics that add to them'}
		buildings={data.owned.filter((b) => b.ownerType === 'corporate')}
		{civics}
		selected={empire.draft.civics}
		reasons={(k) => compat.reasons('civic', k)}
		ontoggle={(k) => empire.toggleCivic(k)}
		ownerLabel="capital"
		names={{ ...data.names, ...data.traditionPerkNames }}
	/>
	<UnlockTable
		unlocks={data.unlocks}
		names={data.names}
		{isPicked}
		reasons={(p) => compat.reasons(p.kind, p.key)}
		ontoggle={togglePick}
	/>
</main>
