<script lang="ts">
	import type { PageData } from './$types';
	import type { FederationType } from '$lib/server/db';
	import { resolve } from '$app/paths';
	import EmpireProfileBar from '$lib/EmpireProfileBar.svelte';
	import RequirementChips from '$lib/RequirementChips.svelte';
	import BackToTop from '$lib/BackToTop.svelte';
	import JumpLinks from '$lib/JumpLinks.svelte';
	import FederationLink from '$lib/FederationLink.svelte';
	import Tip from '$lib/Tip.svelte';
	import { settings } from '$lib/settings.svelte';
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';
	import { federationSearchText, federationTip, SCOPE_LABELS } from '$lib/federations';
	import { matches } from '$lib/traditions';
	import { evaluate, isActive, requirementLines, triggerText, withAllDlc } from '$lib/triggers';

	let { data }: { data: PageData } = $props();

	let query = $state('');
	const profile = $derived(settings.empireProfile);
	const filtering = $derived(isActive(profile) || profile.ethics !== undefined);

	// Requirement names: the layout's entity names plus the tradition finishers (by swap key).
	const names = $derived.by(() => {
		const out: Record<string, string> = { ...(data.names ?? {}) };
		for (const [k, f] of Object.entries(data.finishers)) out[k] = `${f.name} finished`;
		return out;
	});

	// Shown in the chips: who may form it. All DLC is assumed (withAllDlc); the subject
	// check is noise here.
	const SKIP = ['host_has_dlc', 'federation_check_for_subject_trigger'];

	const view = $derived(
		data.federationTypes.map((t) => {
			const allow = withAllDlc(t.allow);
			const can = evaluate(t.allow, profile);
			return {
				type: t,
				lines: typeof allow === 'boolean' ? [] : requirementLines(allow, names, profile, SKIP),
				trees: [
					...new Map(
						t.unlockedBy
							.flatMap((k) => (data.finishers[k] ? [data.finishers[k]] : []))
							.map((f) => [f.tree, f])
					).values()
				],
				can,
				visible:
					(!filtering || can !== false || settings.showUnavailable) &&
					(!query || matches(federationSearchText(t), query))
			};
		})
	);
	const byKey = $derived(new Map(data.federationTypes.map((t) => [t.key, t])));

	const fmt = (n: number) =>
		(Number.isInteger(n) ? n : parseFloat(n.toFixed(2))).toLocaleString('en');
</script>

{#snippet typeLink(t: FederationType)}
	<FederationLink key={t.key} name={t.name ?? t.key} tip={federationTip(t)} />
{/snippet}

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Federations</h1>
		<p class="max-w-3xl text-sm opacity-60">
			The federation types, what each level grants, and the federation laws. Who may form a type
			follows the empire type below (green = met, red = not met, grey = depends on things the
			planner can't know); "From planned empire" checks your ethics and civics. Assumes all DLC.
		</p>
	</div>

	<JumpLinks
		links={[
			...data.federationTypes.map((t) => ({ id: t.key, label: t.name ?? t.key })),
			{ id: 'laws', label: 'Laws', strong: true }
		]}
	/>

	<EmpireProfileBar
		bind:query
		archetypeOf={data.archetypeOf}
		nomadicOrigins={data.nomadicOrigins}
		placeholder="Search federation types and perks…"
	/>

	<section class="grid gap-3 lg:grid-cols-2">
		{#each view.filter((v) => v.visible) as v (v.type.key)}
			{@const t = v.type}
			<article
				id={t.key}
				class="border-surface-400-500/30 flex scroll-mt-16 flex-col gap-2 rounded-lg border p-3 {filtering &&
				v.can === false
					? 'opacity-40'
					: ''}"
			>
				<header class="flex flex-wrap items-baseline gap-2">
					<h2 class="text-lg font-semibold">{t.name ?? t.key}</h2>
					{#if t.baseIntel !== null}
						<Tip text="Intel members share with each other" class="text-[11px] opacity-50"
							>base intel {t.baseIntel}</Tip
						>
					{/if}
				</header>
				{#if t.description}<p class="text-xs opacity-60">{t.description}</p>{/if}

				{#if v.lines.length}
					<RequirementChips label="Who can form it" lines={v.lines} />
				{:else}
					<p class="text-[11px] opacity-50">Anyone can form it.</p>
				{/if}
				{#if v.trees.length}
					<p class="text-[11px]">
						<span class="opacity-50">Also unlocked by finishing</span>
						{#each v.trees as f, i (f.tree)}{i > 0 ? ', ' : ''}<a
								href="{resolve('/traditions')}#{f.tree}"
								class="text-violet-300 underline decoration-dotted underline-offset-2">{f.name}</a
							>{/each}
					</p>
				{/if}

				<ol class="mt-1 space-y-2">
					{#each t.levels as lv (lv.level)}
						<li class="border-surface-400-500/20 border-t pt-1.5">
							<div class="flex items-baseline gap-2 text-xs">
								<span class="font-semibold">Level {lv.level}</span>
								{#if lv.level === 1}<span class="opacity-50">from the start</span>{/if}
								{#if lv.experience !== null}
									<span class="opacity-40">· {fmt(lv.experience)} XP to level {lv.level + 1}</span>
								{/if}
							</div>
							<ul class="mt-1 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
								{#each lv.perks as p (p.key)}
									<li class="text-xs">
										<Tip text={p.description} class="font-medium">{p.name ?? p.key}</Tip>
										{#each p.modifiers as m, i (i)}
											<div class="flex items-baseline gap-1.5">
												<span class="text-[10px] opacity-45">{SCOPE_LABELS[m.scope]}</span>
												<span class="font-mono font-semibold {modifierColor(m)}"
													>{formatModifierValue(m)}</span
												>
												<span class="opacity-75">{modifierLabel(m)}</span>
												{#if m.potential}
													<Tip
														text={`Only if: ${triggerText(m.potential, names)}`}
														class="text-[10px] opacity-60">(if …)</Tip
													>
												{/if}
											</div>
										{/each}
										{#if p.effect}
											<p class="leading-relaxed whitespace-pre-line opacity-70">{p.effect}</p>
										{/if}
									</li>
								{/each}
							</ul>
						</li>
					{/each}
				</ol>
			</article>
		{:else}
			<p class="text-sm opacity-60">No federation type matches.</p>
		{/each}
	</section>

	<section id="laws" class="scroll-mt-16 space-y-4">
		<div>
			<h2 class="text-lg font-semibold">Laws</h2>
			<p class="max-w-3xl text-xs opacity-60">
				Voted on by the members. Higher laws need the federation's centralization raised first,
				which in turn needs federation levels; most cost cohesion every month while in force.
			</p>
		</div>
		{#each data.lawCategories as c (c.key)}
			<div class="space-y-1">
				<h3 class="font-semibold">{c.name ?? c.key}</h3>
				{#if c.description}<p class="max-w-3xl text-xs opacity-60">{c.description}</p>{/if}
				<div class="overflow-x-auto">
					<table class="w-full text-xs">
						<thead>
							<tr class="border-surface-400-500/40 border-b text-left opacity-60">
								<th class="py-1 pr-3 font-medium">Law</th>
								<th class="py-1 pr-3 font-medium">Effect</th>
								<th class="py-1 pr-3 text-right font-medium whitespace-nowrap">Centralization</th>
								<th class="py-1 pr-3 text-right font-medium whitespace-nowrap">Cohesion / month</th>
								<th class="py-1 font-medium whitespace-nowrap">Only for</th>
							</tr>
						</thead>
						<tbody>
							{#each c.laws as l (l.key)}
								<tr class="border-surface-400-500/20 border-b align-baseline">
									<td class="py-1 pr-3 font-medium whitespace-nowrap">{l.name ?? l.key}</td>
									<td class="py-1 pr-3 opacity-70">{l.description ?? ''}</td>
									<td class="py-1 pr-3 text-right font-mono">{l.requiredCentralization ?? '—'}</td>
									<td
										class="py-1 pr-3 text-right font-mono {l.cohesionGrowth !== null &&
										l.cohesionGrowth < 0
											? 'text-red-400'
											: ''}">{l.cohesionGrowth !== null ? fmt(l.cohesionGrowth) : '—'}</td
									>
									<td class="py-1">
										{#each l.types as k, i (k)}{i > 0
												? ', '
												: ''}{#if byKey.get(k)}{@render typeLink(
													byKey.get(k)!
												)}{:else}{k}{/if}{/each}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/each}
	</section>
</main>

<BackToTop />
