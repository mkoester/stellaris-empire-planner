<script lang="ts">
	import type { PageData } from './$types';
	import type { Origin, Civic } from '$lib/server/db';
	import { civicTypeLabel } from '$lib/civics';
	import { empire } from '$lib/empire.svelte';
	import { compatChecker } from '$lib/compat';
	import { conflictClass } from '$lib/conflict';
	import ConflictBadge from '$lib/ConflictBadge.svelte';

	let { data }: { data: PageData } = $props();
	// Debug: render selectable cards as plain elements so their text can be copied.
	const debug = $derived(data.debugDisableSelection);

	// Current ship type from the empire draft (organic = a biogenesis appearance).
	const shipType = $derived(
		empire.draft.graphicalCulture == null
			? null
			: empire.draft.graphicalCulture.startsWith('biogenesis')
				? 'organic'
				: 'regular'
	);

	// Cross-section conflicts (warn only — see $lib/compat): origin/civic ship-type gates.
	const compat = $derived(compatChecker(empire.draft, data));

	type Req = { kind: string; operator: string; value: string };
	const shipTypeOrganic = (op: string) => (reqs: Req[]) =>
		reqs.some((r) => r.kind === 'ship_type' && r.operator === op && r.value === 'organic');
	const forbidsOrganic = shipTypeOrganic('forbid');
	const requiresOrganic = shipTypeOrganic('require_any');

	const origins = $derived(data.origins as Origin[]);
	const civics = $derived(data.civics as Civic[]);
	const lockedOrigins = $derived(origins.filter((o) => forbidsOrganic(o.requirements)));
	const lockedCivics = $derived(civics.filter((c) => forbidsOrganic(c.requirements)));
	const organicOrigins = $derived(origins.filter((o) => requiresOrganic(o.requirements)));
	const organicCivics = $derived(civics.filter((c) => requiresOrganic(c.requirements)));
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<h1 class="text-2xl font-bold">Ships</h1>

	<section class="max-w-3xl space-y-3 text-sm opacity-80">
		<p>
			An empire's fleet uses one of two ship types, set by its <strong>ship appearance</strong>
			(graphical culture) at creation:
		</p>
		<ul class="ml-4 list-disc space-y-1 opacity-90">
			<li>
				<strong>Regular ships</strong> — the standard, mechanical hulls used by most empires.
			</li>
			<li>
				<strong>Organic ships</strong> (bio-ships) — living vessels from the
				<em>Biogenesis</em> appearances. A biological shipset also starts the homeworld with an
				extra
				<strong>+1 agriculture district</strong>, and uses its own organic ship components.
			</li>
		</ul>
		<p class="opacity-60">
			Ship type is a free pick at empire creation — but some origins and civics force or forbid the
			organic appearance:
		</p>
	</section>

	<!-- Empire ship-type pick -->
	<section class="space-y-2">
		<h2 class="text-lg font-semibold">Your ship type</h2>
		<div class="flex flex-wrap gap-2">
			{#each [{ id: 'regular', label: 'Regular' }, { id: 'organic', label: 'Organic (bio-ships)' }] as opt (opt.id)}
				{@const conflicts = compat.reasons('ship_type', opt.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<svelte:element
					this={debug ? 'div' : 'button'}
					type={debug ? undefined : 'button'}
					aria-pressed={debug ? undefined : shipType === opt.id}
					onclick={debug
						? undefined
						: () =>
								empire.setShipType(shipType === opt.id ? null : (opt.id as 'regular' | 'organic'))}
					class="flex items-center gap-2 rounded border px-3 py-1.5 text-sm transition-colors {shipType ===
					opt.id
						? 'border-primary-500 bg-primary-500/10'
						: 'border-surface-400-500/30 hover:border-surface-400-500/60'} {conflictClass(
						conflicts,
						shipType === opt.id
					)} {debug ? 'cursor-text select-text' : ''}"
				>
					{opt.label}
					<ConflictBadge reasons={conflicts} />
				</svelte:element>
			{/each}
		</div>
	</section>

	{#if organicOrigins.length || organicCivics.length}
		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Force organic ships</h2>
			<div class="flex flex-wrap gap-2">
				{#each organicOrigins as o (o.key)}
					<span class="rounded border border-emerald-500/30 px-2 py-1 text-sm">
						{o.name ?? o.key}<span class="text-[10px] opacity-40"> origin</span>
					</span>
				{/each}
				{#each organicCivics as c (c.key)}
					<span class="rounded border border-emerald-500/30 px-2 py-1 text-sm">
						{c.name ?? c.key}<span class="text-[10px] opacity-40">
							{civicTypeLabel(c.civicType)}</span
						>
					</span>
				{/each}
			</div>
		</section>
	{/if}

	<section class="space-y-2">
		<h2 class="text-lg font-semibold">
			Origins that exclude organic ships
			<span class="text-sm font-normal opacity-40">· {lockedOrigins.length}</span>
		</h2>
		<div class="flex flex-wrap gap-2">
			{#each lockedOrigins as o (o.key)}
				<span class="border-surface-400-500/30 rounded border px-2 py-1 text-sm"
					>{o.name ?? o.key}</span
				>
			{/each}
		</div>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-semibold">
			Civics that exclude organic ships
			<span class="text-sm font-normal opacity-40">· {lockedCivics.length}</span>
		</h2>
		<div class="flex flex-wrap gap-2">
			{#each lockedCivics as c (c.key)}
				<span class="border-surface-400-500/30 rounded border px-2 py-1 text-sm">
					{c.name ?? c.key}
					<span class="text-[10px] opacity-40">{civicTypeLabel(c.civicType)}</span>
				</span>
			{/each}
		</div>
	</section>
</main>
