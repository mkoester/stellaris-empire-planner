<script lang="ts">
	import type { PageData } from './$types';
	import type { Authority } from '$lib/server/db';
	import { dlcBadge } from '$lib/precursors';
	import Tip from '$lib/Tip.svelte';
	import {
		formatModifierValue,
		modifierColor,
		modifierLabel,
		civicRequirementLines,
		requirementChipClass,
		AUTHORITY_REQUIREMENT_KINDS
	} from '$lib/civics';
	import RuleText from '$lib/RuleText.svelte';
	import RequirementLegend from '$lib/RequirementLegend.svelte';
	import { empire } from '$lib/empire.svelte';
	import ConflictBadge from '$lib/ConflictBadge.svelte';
	import { compatChecker } from '$lib/compat';
	import { conflictClass } from '$lib/conflict';

	let { data }: { data: PageData } = $props();
	// Cross-section conflicts (warn only — see $lib/compat).
	const compat = $derived(compatChecker(empire.draft, data));
	const authorities = $derived(data.authorities as Authority[]);
	// Debug: render selectable cards as plain elements so their text can be copied.
	const debug = $derived(data.debugDisableSelection);

	// Government is a single choice — clicking the selected one clears it.
	function toggle(key: string) {
		empire.setAuthority(empire.draft.authority === key ? null : key);
	}
</script>

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold">Government</h1>
			<p class="text-sm opacity-50">The empire's authority — its government type. Pick one.</p>
		</div>
		<RequirementLegend kinds={AUTHORITY_REQUIREMENT_KINDS} />
	</div>

	<div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
		{#each authorities as authority (authority.key)}
			{@const reqs = civicRequirementLines(authority.requirements)}
			{@const selected = empire.draft.authority === authority.key}
			{@const conflicts = compat.reasons('authority', authority.key)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<svelte:element
				this={debug ? 'div' : 'button'}
				type={debug ? undefined : 'button'}
				aria-pressed={debug ? undefined : selected}
				onclick={debug ? undefined : () => toggle(authority.key)}
				class="relative flex h-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors {selected
					? 'border-primary-500 bg-primary-500/10'
					: 'border-surface-400-500/30 hover:border-surface-400-500/60'} {conflictClass(
					conflicts,
					selected
				)} {debug ? 'cursor-text select-text' : ''}"
			>
				<header class="flex flex-wrap items-baseline gap-2">
					<h3 class="font-semibold">{authority.name ?? authority.key}</h3>
					<ConflictBadge reasons={conflicts} />
					{#if authority.requiredDlc}
						<Tip
							text={authority.requiredDlc}
							class="rounded border px-1.5 py-0.5 text-[10px] font-normal {dlcBadge(
								authority.requiredDlc
							)}">DLC</Tip
						>
					{/if}
				</header>

				<!-- Requirements / exclusions (ethics + species archetype) -->
				{#if reqs.length}
					<div class="flex flex-wrap gap-1">
						{#each reqs as r, i (i)}
							<span class="rounded px-1.5 py-0.5 text-[10px] {requirementChipClass(r)}"
								>{r.type === 'require' ? 'needs' : 'excl.'} {r.text}</span
							>
						{/each}
					</div>
				{/if}

				<!-- Numeric country modifiers -->
				{#if authority.modifiers.length}
					<ul class="space-y-0.5 text-xs">
						{#each authority.modifiers as mod (mod.key)}
							<li class="flex items-baseline justify-between gap-3">
								<span class="opacity-70">{modifierLabel(mod)}</span>
								<span class="shrink-0 font-mono {modifierColor(mod)}"
									>{formatModifierValue(mod)}</span
								>
							</li>
						{/each}
					</ul>
				{/if}

				{#if authority.description}
					<div class="mt-auto">
						<RuleText text={authority.description} class="text-xs opacity-55" />
					</div>
				{/if}
			</svelte:element>
		{/each}
	</div>
</main>
