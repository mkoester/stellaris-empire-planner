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
	import SwapTables from '$lib/SwapTables.svelte';
	import Tip from '$lib/Tip.svelte';
	import BanIcon from '$lib/BanIcon.svelte';
	import RuleText from '$lib/RuleText.svelte';
	import RequirementLegend from '$lib/RequirementLegend.svelte';
	import { keyName } from '$lib/empireFile';
	import { empire } from '$lib/empire.svelte';
	import { settings } from '$lib/settings.svelte';
	import ConflictBadge from '$lib/ConflictBadge.svelte';
	import { compatChecker } from '$lib/compat';
	import type { JobSwap } from '$lib/server/db';

	let { data }: { data: PageData } = $props();
	// Cross-section conflicts (warn only — see $lib/compat).
	const compat = $derived(compatChecker(empire.draft, data));
	const origins = $derived(data.origins as Origin[]);
	const names = $derived((data.names ?? {}) as Record<string, string>);
	const jobSwaps = $derived((data.jobSwaps ?? {}) as Record<string, JobSwap[]>);
	// Debug: render selectable cards as plain elements so their text can be copied.
	const debug = $derived(data.debugDisableSelection);

	let query = $state('');

	// Per-card override of the global "show exclusions" default, keyed by origin key.
	let openExcl = $state<Record<string, boolean>>({});
	function toggleExcl(key: string) {
		openExcl = { ...openExcl, [key]: !(openExcl[key] ?? settings.showExclusions) };
	}

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

	<div class="flex flex-wrap items-center gap-2">
		<input class="input max-w-sm" type="search" placeholder="Filter origins…" bind:value={query} />
		<button
			class="rounded px-2 py-1 text-[11px] opacity-60 hover:bg-surface-500/20 hover:opacity-100"
			onclick={() => settings.toggleExclusions()}
		>
			{settings.showExclusions ? 'Hide exclusions' : 'Show exclusions'}
		</button>
	</div>

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
					{@const reqs = civicRequirementLines(origin.requirements, data.names)}
					{@const needs = reqs.filter((r) => r.type === 'require')}
					{@const excls = reqs.filter((r) => r.type === 'exclude')}
					{@const showExcl = openExcl[origin.key] ?? settings.showExclusions}
					{@const selected = empire.draft.origin === origin.key}
					{@const conflicts = compat.reasons('origin', origin.key)}
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
							: 'border-surface-400-500/30 hover:border-surface-400-500/60'} {conflicts.length
							? 'ring-2 ring-red-500/70 ring-inset'
							: ''} {debug ? 'cursor-text select-text' : ''}"
					>
						<div class="flex items-start justify-between gap-2">
							<h3 class="font-semibold">{origin.name ?? origin.key}</h3>
							<ConflictBadge reasons={conflicts} class="ml-auto" />
							{#if swaps.length || origin.ascensionLock || origin.ascensionBlocks.length}
								<div class="flex shrink-0 flex-wrap items-center justify-end gap-1">
									{#if swaps.length}
										<SwapTables {swaps} />
									{/if}
									{#if origin.ascensionLock}
										<Tip
											text="Locked to {origin.ascensionLock} Ascension — blocks all other ascension paths"
											class="rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-200"
										>
											{origin.ascensionLock} ascension only
										</Tip>
									{:else}
										{#each origin.ascensionBlocks as path (path)}
											<Tip
												text="Cannot pursue {path} Ascension"
												class="rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-200"
											>
												no {path} ascension
											</Tip>
										{/each}
									{/if}
								</div>
							{/if}
						</div>

						{#if needs.length || excls.length}
							<div class="flex items-start gap-1">
								<div class="flex grow flex-wrap items-center gap-1">
									{#each needs as r, i (i)}
										<span class="rounded px-1.5 py-0.5 text-[10px] {requirementChipClass(r)}"
											>needs {r.text}</span
										>
									{/each}
									{#if showExcl}
										{#each excls as r, i (i)}
											<span class="rounded px-1.5 py-0.5 text-[10px] {requirementChipClass(r)}"
												>excl. {r.text}</span
											>
										{/each}
									{/if}
								</div>
								{#if excls.length}
									<Tip text={showExcl ? 'Hide exclusions' : 'Show exclusions'}>
										{#snippet trigger(a)}
											<span
												{...a}
												role="button"
												tabindex="0"
												aria-pressed={showExcl}
												aria-label="{showExcl ? 'Hide' : 'Show'} exclusions"
												onclick={(e) => {
													e.stopPropagation();
													toggleExcl(origin.key);
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														e.stopPropagation();
														toggleExcl(origin.key);
													}
												}}
												class="inline-flex shrink-0 cursor-pointer items-center rounded px-0.5 py-0.5 transition-colors {showExcl
													? 'text-red-400'
													: 'text-red-400/40 hover:text-red-400/70'}"
											>
												<BanIcon />
											</span>
										{/snippet}
									</Tip>
								{/if}
							</div>
						{/if}

						{#if origin.startingColony || origin.forcesHomeSystem}
							<div class="flex flex-wrap gap-1">
								{#if origin.startingColony}
									<Tip
										text="This origin starts you on a specific world, overriding the Planets pick"
										class="rounded bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200/90"
									>
										Starts on: <span class="font-medium"
											>{keyName(origin.startingColony, names)}</span
										>
									</Tip>
								{/if}
								{#if origin.forcesHomeSystem}
									<Tip
										text="This origin places you in a fixed home system, overriding the Home-system pick"
										class="rounded bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200/90"
									>
										Fixed home system
									</Tip>
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

						{#snippet descBody()}
							{#if mods.attunement.length}<hr class="my-1 border-current opacity-45" />{/if}
							<RuleText text={origin.description!} class="text-xs opacity-55" />
						{/snippet}
						{#if origin.description}
							{#if swaps.length}
								<SwapTables {swaps} placement="top-start" triggerClass="mt-auto block cursor-help">
									{@render descBody()}
								</SwapTables>
							{:else}
								<div class="mt-auto">{@render descBody()}</div>
							{/if}
						{/if}
					</svelte:element>
				{/each}
			</div>
		</section>
	{/each}
</main>
