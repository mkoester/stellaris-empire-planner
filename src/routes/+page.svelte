<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';

	// No own load — this page reads the shared layout data (game/app version, …).
	let { data }: { data: PageData } = $props();

	// Primary entry points into the planner, surfaced as cards on the landing page.
	const LINKS = [
		{ href: '/species', label: 'Species Builder', blurb: 'Pick a phenotype, class and traits.' },
		{ href: '/empire', label: 'Empire', blurb: 'Assemble and import/export a full empire.' },
		{ href: '/ethics', label: 'Ethics', blurb: 'Ethic choices and their effects.' },
		{ href: '/civics', label: 'Civics', blurb: 'Civics with modifiers and eligibility.' },
		{ href: '/origins', label: 'Origins', blurb: 'Starting scenarios and what they lock.' },
		{ href: '/government', label: 'Government', blurb: 'Authority / government types.' }
	] as const;
</script>

<main class="mx-auto max-w-4xl space-y-10 p-4 py-10">
	<header class="space-y-3">
		<h1 class="text-3xl font-bold">Stellaris Empire Planner</h1>
		<p class="text-lg opacity-70">
			Plan a custom empire against the live game data — species, ethics, civics, origins and more.
		</p>
		<div class="flex flex-wrap gap-2 text-[11px] opacity-50">
			<span class="rounded border border-warning-500/40 px-2 py-0.5 text-warning-400 opacity-100">
				early alpha
			</span>
			{#if data?.gameVersion}
				<span class="border-surface-400-500/30 rounded border px-2 py-0.5">
					Stellaris {data.gameVersion.raw ?? data.gameVersion.version}
				</span>
			{/if}
			{#if data?.appVersion}
				<span class="border-surface-400-500/30 rounded border px-2 py-0.5"
					>planner v{data.appVersion}</span
				>
			{/if}
		</div>
	</header>

	<!-- ─────────────────────────────────────────────────────────────────────────
	     PROJECT STATE — edit freely. This is plain markup.
	     ───────────────────────────────────────────────────────────────────────── -->
	<section class="space-y-3">
		<h2 class="text-xl font-semibold">About this project</h2>
		<div class="space-y-3 leading-relaxed opacity-80">
			<p>
				This is an <strong>early alpha</strong>. It's shared at this stage mainly to
				<strong>gather feedback from other Stellaris players</strong> — what's useful, what's confusing,
				and what's missing.
			</p>
			<p>
				Most of the planned features are already here, but expect <strong
					>rough edges and bugs</strong
				>. The planner is also only as complete as the data behind it:
				<strong>not everything is extracted from the game files yet</strong>, so there are known
				gaps in what it can show.
			</p>
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold">Status</h2>
		<ul class="list-inside list-disc space-y-1 opacity-80">
			<li>Early alpha — for feedback, not a finished tool.</li>
			<li>Most planned features are in place, but still buggy.</li>
			<li>Not all game data is extracted yet — there are gaps in the data.</li>
			<li>The design isn't unified yet — some sections look a bit different from others.</li>
		</ul>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold">Ideas for the future</h2>
		<p class="opacity-80">A few things being considered — no promises on timing:</p>
		<ul class="list-inside list-disc space-y-1 opacity-80">
			<li>
				A toggle between a <strong>strict</strong> and a <strong>loosened</strong> mode: strict surfaces
				rule conflicts, while loosened lets you bend the constraints — adjusting things like available
				trait points and picks, the number of starting civics, and so on (handy if you play with mods).
			</li>
			<li>
				Export an empire <strong>directly into the game's user-created empires file</strong> (the
				<code>.txt</code> in the Stellaris folder), not just a copy/paste.
			</li>
			<li>
				Richer <strong>tagging</strong>, with possible <strong>synergies</strong> highlighted.
			</li>
		</ul>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold">Jump in</h2>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each LINKS as link (link.href)}
				<a
					href={resolve(link.href)}
					class="border-surface-400-500/30 block rounded-lg border p-4 transition-colors hover:bg-surface-500/10"
				>
					<div class="font-medium">{link.label}</div>
					<div class="mt-1 text-sm opacity-60">{link.blurb}</div>
				</a>
			{/each}
		</div>
	</section>
</main>
