<script lang="ts">
	import type { PageData } from './$types';
	import type { IdeologyModifier, Tenet } from '#lib/server/db/index.ts';
	import { resolve } from '$app/paths';
	import BuildingName from '#lib/BuildingName.svelte';
	import JumpLinks from '#lib/JumpLinks.svelte';
	import Tip from '#lib/Tip.svelte';
	import { formatModifierValue, modifierColor, modifierLabel } from '#lib/civics.ts';
	import {
		anyIdeologyTenets,
		ethicSections,
		PRIORITY_TIPS,
		ROMAN,
		sharedFamilies,
		TENET_SCOPE_LABELS,
		tenetFamily,
		tenetSearchText,
		tierEffects,
		tierRows
	} from '#lib/ideologies.ts';
	import { matches } from '#lib/traditions.ts';
	import { triggerText } from '#lib/triggers.ts';

	let { data }: { data: PageData } = $props();

	let query = $state('');

	const names = $derived(data.names ?? {});
	const ethicName = (key: string | null) =>
		key ? (names[key] ?? key.replace(/^ethic_/, '').replace(/_/g, ' ')) : '?';
	const sections = $derived(ethicSections(data.ideologies, data.tenets));
	const anyTenets = $derived(anyIdeologyTenets(data.tenets));
	const shared = $derived(
		sharedFamilies(
			data.tenets,
			sections.map((s) => s.ethic)
		)
	);
	const visible = (t: Tenet) => !query || matches(tenetSearchText(t), query);

	// Adoption effects every ideology has (the common data) vs. those of one ethic.
	const modId = (m: IdeologyModifier) =>
		JSON.stringify([m.scope, m.level, m.key, m.value, m.potential, m.scaledBy]);
	const commonIds = $derived.by(() => {
		const [first, ...rest] = data.ideologies;
		if (!first) return new Set<string>();
		const sets = rest.map((i) => new Set(i.modifiers.map(modId)));
		return new Set(first.modifiers.map(modId).filter((id) => sets.every((s) => s.has(id))));
	});
	const common = $derived(
		data.ideologies[0]?.modifiers.filter((m) => commonIds.has(modId(m))) ?? []
	);
	const levels = $derived(data.ideologies[0]?.levels ?? []);
	const byLevel = (lv: number) => common.filter((m) => m.level === lv);
	const ungated = $derived(common.filter((m) => m.level === null));

	const def = (k: string) => data.defines[k];
	const slots = $derived(def('TENETS_SELECTION_AMOUNT') ?? 3);
	const tierMax = $derived(def('TENETS_TIER_MAX') ?? 3);
	const amendCosts = $derived(
		[1, 2, 3].map((n) => def(`TENET_AMENDMENT_INFLUENCE_COST_${n}`)).filter((v) => v !== undefined)
	);
	const years = (days: number | undefined) =>
		days === undefined ? '?' : days % 360 === 0 ? `${days / 360} years` : `${days} days`;

	const buildingByKey = $derived(new Map(data.buildings.map((b) => [b.key, b])));
	// where an adoption effect applies: the game's own tooltip header, else the scope
	const SCOPE_TEXT = { country: 'Adopter', system: 'Systems', pop_group: 'Followers' };
	const where = (m: IdeologyModifier) => m.header?.replace(/:$/, '') ?? SCOPE_TEXT[m.scope];
	const fmt = (n: number) =>
		(Number.isInteger(n) ? n : parseFloat(n.toFixed(3))).toLocaleString('en');
	const concept = (k: string) => data.concepts[k];
</script>

{#snippet adoptMod(m: IdeologyModifier)}
	<li class="flex flex-wrap items-baseline gap-1.5 text-xs">
		<span class="text-[10px] opacity-45">{where(m)}</span>
		<span class="font-mono font-semibold {modifierColor(m)}">{formatModifierValue(m)}</span>
		<span class="opacity-75">{modifierLabel(m)}</span>
		{#if m.scaledBy}
			<Tip
				text={`Scaled by ${m.scaledBy}, which only the running game knows`}
				class="text-[10px] opacity-60"
			>
				(scaled)
			</Tip>
		{/if}
		{#if m.potential && m.level === null}
			<Tip text={`Only if: ${triggerText(m.potential, names)}`} class="text-[10px] opacity-60">
				(if …)
			</Tip>
		{/if}
	</li>
{/snippet}

{#snippet tenetCard(t: Tenet)}
	{@const grid = tierRows(t)}
	{@const effects = tierEffects(t)}
	<article
		id={t.key}
		class="border-surface-400-500/30 flex scroll-mt-16 flex-col gap-1.5 rounded-lg border p-3"
	>
		<header class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
			<h4 class="font-semibold">{t.name ?? t.key}</h4>
			{#each [...new Set(t.swaps.map((s) => s.name).filter(Boolean))] as n (n)}
				<Tip text="Its name for a gestalt empire" class="text-[11px] opacity-50">/ {n}</Tip>
			{/each}
			{#if t.priority !== 'default'}
				<Tip
					text={PRIORITY_TIPS[t.priority]}
					class="rounded px-1.5 text-[10px] {t.priority === 'high'
						? 'bg-amber-500/20 text-amber-300'
						: 'bg-surface-500/20 opacity-70'}"
				>
					{t.priority} priority
				</Tip>
			{/if}
			{#if shared.has(tenetFamily(t))}
				<Tip
					text="Every ideology has a version of this tenet"
					class="rounded bg-sky-500/15 px-1.5 text-[10px] text-sky-300"
				>
					every ideology
				</Tip>
			{/if}
			{#if t.sourceCivic}
				<span class="rounded bg-violet-500/15 px-1.5 text-[10px] text-violet-300">
					{names[t.sourceCivic] ?? t.sourceCivic}
				</span>
			{/if}
		</header>
		{#if t.description}<p class="text-xs opacity-60">{t.description}</p>{/if}
		{#if t.potential}
			<p class="text-[11px] opacity-50">Only for: {triggerText(t.potential, names)}</p>
		{/if}

		{#if grid.rows.length}
			<table class="mt-1 w-full text-xs">
				<thead>
					<tr class="text-[10px] opacity-50">
						<th class="text-left font-normal">Intensity</th>
						{#each grid.tiers as n (n)}<th class="w-14 text-right font-normal">
								{ROMAN[n] ?? n}
							</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each grid.rows as row, i (i)}
						<tr class="border-surface-400-500/10 border-t align-baseline">
							<td class="py-0.5 pr-2">
								<span class="opacity-75">{modifierLabel(row.mod)}</span>
								{#if row.mod.scope !== 'country'}
									<span class="text-[10px] opacity-45">· {TENET_SCOPE_LABELS[row.mod.scope]}</span>
								{/if}
								{#if row.mod.potential}
									<Tip
										text={`Only if: ${triggerText(row.mod.potential, names)}`}
										class="text-[10px] opacity-60"
									>
										(if …)
									</Tip>
								{/if}
								{#if row.mod.possible}
									<Tip
										text={`Active only while: ${triggerText(row.mod.possible, names)}`}
										class="text-[10px] opacity-60"
									>
										(while …)
									</Tip>
								{/if}
							</td>
							{#each row.values as v, j (j)}
								<td
									class="py-0.5 text-right font-mono font-semibold {v === null
										? 'opacity-30'
										: modifierColor({ ...row.mod, value: v })}"
								>
									{v === null ? '–' : formatModifierValue({ ...row.mod, value: v })}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
		{#each effects as e (e.tier)}
			<p class="text-xs whitespace-pre-line opacity-75">
				{#if t.tiers.length > 1}<span class="text-[10px] opacity-50">
						from {ROMAN[e.tier] ?? e.tier}:
					</span>{/if}
				{e.text}
			</p>
		{/each}
		{#if t.unlockText}
			<p class="text-xs whitespace-pre-line">
				<span class="text-[10px] opacity-50">When codified:</span>
				{t.unlockText}
			</p>
		{/if}
		{#if t.unlocks.some((u) => u.name)}
			<p class="flex flex-wrap gap-1 text-[11px]">
				{#each t.unlocks.filter((u, i, a) => u.name && a.findIndex((x) => x.kind === u.kind && x.name === u.name) === i) as u (u.kind + u.key)}
					<Tip text={u.description} class="rounded bg-surface-500/20 px-1.5">
						{u.kind}: {u.name}
					</Tip>
				{/each}
			</p>
		{/if}
		{#if t.lockText}
			<p class="text-[11px] whitespace-pre-line opacity-60">
				If the ideology is lost: {t.lockText}
			</p>
		{/if}
	</article>
{/snippet}

<main class="mx-auto max-w-7xl space-y-6 p-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Ideologies</h1>
		<p class="max-w-3xl text-sm opacity-60">
			The ideologies an empire can adopt (one per ethic), what their strength gives, and the tenets
			each can codify, with their values at every Intensity.
		</p>
	</div>

	<JumpLinks
		links={[
			{ id: 'how', label: 'How it works', strong: true },
			{ id: 'strength', label: 'Strength', strong: true },
			...sections.map((s) => ({ id: s.ethic, label: ethicName(s.ethic) })),
			{ id: 'any', label: 'Any ideology' },
			{ id: 'buildings', label: 'Buildings' }
		]}
	/>

	<section id="how" class="scroll-mt-16 space-y-3">
		<h2 class="text-lg font-semibold">How it works</h2>
		{#if concept('concept_ideology')?.text}
			<p class="max-w-3xl text-sm whitespace-pre-line opacity-75">
				{concept('concept_ideology')?.text}
			</p>
		{/if}
		<div class="grid gap-3 lg:grid-cols-2">
			<div class="border-surface-400-500/30 space-y-2 rounded-lg border p-3 text-sm">
				<h3 class="font-semibold">Tenets</h3>
				<ul class="list-disc space-y-1 pl-5 text-xs opacity-85">
					<li>
						An ideology codifies <b>{slots} tenets</b>, picked by its Ideological Authority from a
						few offered at a time.
						{#each data.extraTenetPerks as p (p.key)}
							A <b>{slots + p.amount}th</b> comes with
							<a
								href="{resolve('/ambitions')}#{p.pathKey}"
								class="text-violet-300 underline decoration-dotted underline-offset-2"
							>
								{p.name ?? p.key}
							</a>, a perk of the
							{p.pathName ?? 'an'} Ambition{p.pathLevel ? ` (level ${p.pathLevel})` : ''}.
						{/each}
					</li>
					<li>
						Each tenet grows in <b>Intensity</b> (I to {ROMAN[tierMax] ?? tierMax}); the tables
						below show its value at each.
					</li>
					<li>
						Which strength level opens a tenet slot or raises its Intensity is not in the game files
						(the engine decides it), so this page does not say.
					</li>
					<li>
						Reformulating the offered tenets costs {fmt(def('TENET_REROLL_AMOUNT') ?? 0)} influence (rising
						with repeated rerolls, up to {def('MAX_TENET_REROLL_COUNT_COST_INCREASE') ?? '?'}
						times), every {years(def('TENET_REROLL_DAYS_COOLDOWN'))} at most.
					</li>
					{#if amendCosts.length}
						<li>
							Amending a codified tenet costs {amendCosts.map(fmt).join(' / ')} influence by its Intensity,
							once every {years(def('TENET_AMENDMENT_DAYS_COOLDOWN'))}.
						</li>
					{/if}
					<li>
						<b>High priority</b> tenets (from an origin or civic) are always offered while their
						requirement holds; <b>low priority</b> ones only when nothing else is left.
					</li>
				</ul>
			</div>
			<div class="border-surface-400-500/30 space-y-2 rounded-lg border p-3 text-sm">
				<h3 class="font-semibold">Strength levels and what adopting gives</h3>
				<table class="w-full text-xs">
					<thead>
						<tr class="text-[10px] opacity-50">
							<th class="w-14 text-left font-normal">Level</th>
							<th class="w-24 text-left font-normal">Strength</th>
							<th class="text-left font-normal">Adopter effects at this level</th>
						</tr>
					</thead>
					<tbody>
						{#each levels as lv (lv.level)}
							<tr class="border-surface-400-500/10 border-t align-top">
								<td class="py-1">{lv.level}</td>
								<td class="py-1 font-mono">
									{fmt(lv.start ?? 0)}–{lv.end === null ? '?' : fmt(lv.end)}
								</td>
								<td class="py-1">
									<ul>
										{#each byLevel(lv.level) as m, i (i)}{@render adoptMod(m)}{/each}
									</ul>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if ungated.length}
					<h4 class="pt-1 text-xs font-semibold">At any level, when the condition holds</h4>
					<ul>
						{#each ungated as m, i (i)}{@render adoptMod(m)}{/each}
					</ul>
				{/if}
			</div>
		</div>
		<div class="grid gap-3 md:grid-cols-3">
			{#each ['concept_ideology_momentum', 'concept_ideological_reach', 'concept_ideological_rival'] as k (k)}
				{#if concept(k)?.text}
					<div class="border-surface-400-500/30 rounded-lg border p-3">
						<h3 class="text-sm font-semibold">{concept(k)?.name}</h3>
						<p class="mt-1 text-xs whitespace-pre-line opacity-70">{concept(k)?.text}</p>
					</div>
				{/if}
			{/each}
		</div>
	</section>

	<section id="strength" class="scroll-mt-16 space-y-3">
		<h2 class="text-lg font-semibold">Where Ideological Strength comes from</h2>
		<div class="grid gap-3 lg:grid-cols-2">
			{#if concept('concept_ideological_strength_sources')?.text}
				<div class="border-surface-400-500/30 rounded-lg border p-3">
					<h3 class="text-sm font-semibold">The game's summary (monthly)</h3>
					<p class="mt-1 text-xs whitespace-pre-line opacity-80">
						{concept('concept_ideological_strength_sources')?.text}
					</p>
				</div>
			{/if}
			<div class="border-surface-400-500/30 rounded-lg border p-3">
				<h3 class="text-sm font-semibold">Every source, as the monthly tooltip lists it</h3>
				{#each [...new Set(data.strengthSources.map((s) => s.category))] as cat (cat)}
					<h4 class="mt-2 text-xs font-semibold opacity-80">{cat ?? 'Overrides'}</h4>
					<ul class="space-y-0.5 text-xs">
						{#each data.strengthSources.filter((s) => s.category === cat) as s, i (i)}
							<li class="flex flex-wrap items-baseline gap-1.5">
								<span
									class="w-16 shrink-0 font-mono text-[11px] {s.op === 'subtract'
										? 'text-red-400'
										: s.op === 'set'
											? 'text-amber-300'
											: 'text-emerald-400'}"
								>
									{#if s.value !== null}
										{s.op === 'mult'
											? '×'
											: s.op === 'set'
												? '='
												: s.op === 'subtract'
													? '−'
													: '+'}{fmt(s.value)}
									{:else}
										{s.op === 'mult' ? '× varies' : s.op === 'subtract' ? '− varies' : '+ varies'}
									{/if}
								</span>
								<span class="opacity-80">{s.label ?? s.valueRef}</span>
								{#if s.condition}
									<Tip
										text={`Only if: ${triggerText(s.condition, names)}`}
										class="text-[10px] opacity-60"
									>
										(if …)
									</Tip>
								{/if}
							</li>
						{/each}
					</ul>
				{/each}
			</div>
		</div>
	</section>

	<label class="block max-w-md">
		<span class="sr-only">Search tenets</span>
		<input
			bind:value={query}
			type="search"
			placeholder="Search tenets…"
			class="input w-full rounded border px-3 py-1.5 text-sm"
		/>
	</label>

	{#each sections as s (s.ethic)}
		{@const shown = s.tenets.filter(visible)}
		<section id={s.ethic} class="scroll-mt-16 space-y-2">
			<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h2 class="text-lg font-semibold">
					{ethicName(s.ethic)}
					{s.ideologies[0]?.typeName ?? 'Ideology'}
				</h2>
				<span class="text-xs opacity-60">{s.tenets.length} tenets</span>
			</div>
			<ul class="space-y-0.5 text-xs opacity-75">
				{#each s.ideologies as i (i.key)}
					<li>
						{#if s.ideologies.length > 1}
							<b>{ethicName(i.secondaryEthic)} variant</b> — picked when the empire is {ethicName(
								i.secondaryEthic
							)}, never when {ethicName(i.opposedSecondaryEthic)}.
						{/if}
						Represented by the <b>{i.factionName ?? i.faction}</b>{i.reach === 'militarist_reach'
							? '; its reach is pushed harder by fleets'
							: ''}.
						{#each i.modifiers.filter((m) => !commonIds.has(modId(m))) as m, j (j)}
							<span class="ml-1">
								<span class="font-mono font-semibold {modifierColor(m)}">
									{formatModifierValue(m)}
								</span>
								{modifierLabel(m)}{m.scaledBy ? ' (scales with Ideological Strength)' : ''}
							</span>
						{/each}
					</li>
				{/each}
			</ul>
			<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{#each shown as t (t.key)}{@render tenetCard(t)}{/each}
			</div>
			{#if !shown.length}<p class="text-xs opacity-50">No tenet matches the search.</p>{/if}
		</section>
	{/each}

	<section id="any" class="scroll-mt-16 space-y-2">
		<h2 class="text-lg font-semibold">Any ideology</h2>
		<p class="text-xs opacity-60">
			Tenets with no ethic: offered to any ideology (the origin- and civic-bound ones only to their
			empires).
		</p>
		<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
			{#each anyTenets.filter(visible) as t (t.key)}{@render tenetCard(t)}{/each}
		</div>
	</section>

	<section id="buildings" class="scroll-mt-16 space-y-2">
		<h2 class="text-lg font-semibold">Ideological buildings</h2>
		<p class="text-xs opacity-60">
			Buildings only an empire with an ideology may build. Hover a name for its numbers; the full
			list is on <a href={resolve('/buildings')} class="underline">Buildings</a>.
		</p>
		<ul class="grid gap-x-4 gap-y-1 text-xs md:grid-cols-2">
			{#each data.ideologyBuildings as b (b.key)}
				<li>
					<BuildingName
						building={buildingByKey.get(b.key)}
						label={buildingByKey.get(b.key)?.name ?? b.key}
						class="font-medium"
					/>
					{#if b.potential}<span class="opacity-50"> — {triggerText(b.potential, names)}</span>{/if}
				</li>
			{/each}
		</ul>
	</section>
</main>
