<script lang="ts">
	import type { PageData } from './$types';
	import type { Origin } from '$lib/server/db';
	import { dlcBadge } from '$lib/precursors';
	import {
		formatModifierValue,
		modifierColor,
		modifierLabel,
		sortModifiers,
		civicRequirementLines,
		requirementChipClass
	} from '$lib/civics';
	import { swapsTooltip } from '$lib/jobs';
	import RuleText from '$lib/RuleText.svelte';
	import RequirementLegend from '$lib/RequirementLegend.svelte';
	import { keyName } from '$lib/empireFile';
	import { empire } from '$lib/empire.svelte';
	import type { JobSwap } from '$lib/server/db';

	let { data }: { data: PageData } = $props();
	const origins = $derived(data.origins as Origin[]);
	const names = $derived((data.names ?? {}) as Record<string, string>);
	const jobSwaps = $derived((data.jobSwaps ?? {}) as Record<string, JobSwap[]>);
	// Debug: render selectable cards as plain elements so their text can be copied.
	const debug = $derived(data.debugDisableSelection);

	let query = $state('');

	// Filter, then group by DLC (base game first, DLCs in first-appearance order).
	const groups = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const filtered = q
			? origins.filter((o) => `${o.name ?? o.key} ${o.description ?? ''}`.toLowerCase().includes(q))
			: origins;
		const order: (string | null)[] = [];
		const by = new Map<string | null, Origin[]>();
		for (const o of filtered) {
			if (!by.has(o.requiredDlc)) {
				by.set(o.requiredDlc, []);
				order.push(o.requiredDlc);
			}
			by.get(o.requiredDlc)!.push(o);
		}
		return order
			.sort((a, b) => (a === null ? -1 : b === null ? 1 : 0))
			.map((dlc) => ({
				dlc,
				label: dlc ?? 'Base game',
				items: by.get(dlc)!.sort((a, b) => (a.name ?? a.key).localeCompare(b.name ?? b.key))
			}));
	});
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<h1 class="text-2xl font-bold">Origins</h1>
		<RequirementLegend />
	</div>

	<input class="input max-w-sm" type="search" placeholder="Filter origins…" bind:value={query} />

	{#each groups as group (group.label)}
		<section class="space-y-3">
			<h2 class="flex items-center gap-2 text-lg font-semibold">
				{group.label}
				{#if group.dlc}
					<span class="rounded border px-1.5 py-0.5 text-[10px] font-normal {dlcBadge(group.dlc)}"
						>DLC</span
					>
				{/if}
				<span class="text-sm font-normal opacity-40">· {group.items.length}</span>
			</h2>

			<div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
				{#each group.items as origin (origin.key)}
					{@const reqs = civicRequirementLines(origin.requirements)}
					{@const selected = empire.draft.origin === origin.key}
					{@const mods = sortModifiers(origin.modifiers)}
					{@const swaps = jobSwaps[origin.key] ?? []}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<svelte:element
						this={debug ? 'div' : 'button'}
						type={debug ? undefined : 'button'}
						aria-pressed={debug ? undefined : selected}
						onclick={debug ? undefined : () => empire.setOrigin(selected ? null : origin.key)}
						class="flex h-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors {selected
							? 'border-primary-500 bg-primary-500/10'
							: 'border-surface-400-500/30 hover:border-surface-400-500/60'} {debug
							? 'cursor-text select-text'
							: ''}"
					>
						<div class="flex items-start justify-between gap-2">
							<h3 class="font-semibold">{origin.name ?? origin.key}</h3>
							{#if swaps.length || origin.ascensionLock || origin.ascensionBlocks.length}
								<div class="flex shrink-0 flex-wrap items-center justify-end gap-1">
									{#if swaps.length}
										<span
											class="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-200"
											title={swapsTooltip(swaps)}>Replaces</span
										>
									{/if}
									{#if origin.ascensionLock}
										<span
											class="rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-200"
											title="Locked to {origin.ascensionLock} Ascension — blocks all other ascension paths"
										>
											{origin.ascensionLock} ascension only
										</span>
									{:else}
										{#each origin.ascensionBlocks as path (path)}
											<span
												class="rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-200"
												title="Cannot pursue {path} Ascension"
											>
												no {path} ascension
											</span>
										{/each}
									{/if}
								</div>
							{/if}
						</div>

						{#if reqs.length}
							<div class="flex flex-wrap gap-1">
								{#each reqs as r, i (i)}
									<span class="rounded px-1.5 py-0.5 text-[10px] {requirementChipClass(r)}"
										>{r.type === 'require' ? 'needs' : 'excl.'} {r.text}</span
									>
								{/each}
							</div>
						{/if}

						{#if origin.startingColony || origin.forcesHomeSystem}
							<div class="flex flex-wrap gap-1">
								{#if origin.startingColony}
									<span
										class="rounded bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200/90"
										title="This origin starts you on a specific world, overriding the Planets pick"
									>
										Starts on: <span class="font-medium"
											>{keyName(origin.startingColony, names)}</span
										>
									</span>
								{/if}
								{#if origin.forcesHomeSystem}
									<span
										class="rounded bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200/90"
										title="This origin places you in a fixed home system, overriding the Home-system pick"
									>
										Fixed home system
									</span>
								{/if}
							</div>
						{/if}

						{#if mods.main.length || mods.attunement.length}
							{#snippet modRow(mod: (typeof mods.main)[number], muted: boolean)}
								<li class="flex items-baseline justify-between gap-3 {muted ? 'opacity-45' : ''}">
									<span class="opacity-70">{modifierLabel(mod)}</span>
									<span class="shrink-0 font-mono {muted ? '' : modifierColor(mod)}"
										>{formatModifierValue(mod)}</span
									>
								</li>
							{/snippet}
							{#if mods.main.length}
								<ul class="space-y-0.5 text-xs">
									{#each mods.main as mod (mod.key)}{@render modRow(mod, false)}{/each}
								</ul>
							{/if}
							{#if mods.attunement.length}
								<hr class="my-1 border-current opacity-45" />
								<ul class="space-y-0.5 text-xs">
									{#each mods.attunement as mod (mod.key)}{@render modRow(mod, true)}{/each}
								</ul>
							{/if}
						{/if}

						{#if origin.description}
							<div class="mt-auto" title={swaps.length ? swapsTooltip(swaps) : undefined}>
								{#if mods.attunement.length}<hr class="my-1 border-current opacity-45" />{/if}
								<RuleText text={origin.description} class="text-xs opacity-55" />
							</div>
						{/if}
					</svelte:element>
				{/each}
			</div>
		</section>
	{/each}
</main>
