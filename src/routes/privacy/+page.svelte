<script lang="ts">
	// GDPR Art. 13 and TDDDG § 25. Keep in step with what the code and the server actually do
	// (docs/analytics.md): the Caddy log settings, the consent cookie, the two analytics tables.
	import { reopen } from '#lib/consent.svelte.ts';

	let { data } = $props();
</script>

<svelte:head><title>Privacy policy · Stellaris Empire Planner</title></svelte:head>

<main
	class="mx-auto max-w-3xl space-y-6 p-4 [&_h2]:text-lg [&_h2]:font-semibold [&_section]:space-y-2"
>
	<h1 class="text-2xl font-bold">Privacy policy</h1>

	<section>
		<h2>Who is responsible</h2>
		{#if data.operator}
			<address class="not-italic">
				{data.operator.name}<br />
				{#each data.operator.address as line, i (i)}{line}<br />{/each}
				Email: <a href="mailto:{data.operator.email}" class="underline">{data.operator.email}</a>
			</address>
		{:else}
			<p class="opacity-60">The operator's details are not configured on this server.</p>
		{/if}
		<p>
			This site is a free, non-commercial fan project. It shows no ads, has no accounts and loads
			nothing from other websites.
		</p>
	</section>

	<section>
		<h2>Your empire stays in your browser</h2>
		<p>
			What you pick while planning an empire stays in your browser tab. It is not sent to the server
			and not stored.
		</p>
	</section>

	<section>
		<h2>Server logs</h2>
		<p>
			Each request is logged by the web server: the time, the requested address, the response
			status, your browser's user agent and referrer, and your IP address with its last part removed
			(IPv4 shortened to the first three numbers, IPv6 to the first 48 bits), so it no longer points
			to a single connection. Cookies are not logged. The logs are deleted after 7 days.
		</p>
		<p>
			Purpose: running the site and finding faults and attacks. Legal basis: our legitimate interest
			in a secure, working site (GDPR Art. 6(1)(f)). The site runs on a rented server; the hosting
			provider processes this data on our behalf (GDPR Art. 28).
		</p>
	</section>

	<section>
		<h2>Page statistics</h2>
		<p>
			When a page is shown, your browser tells the server which page it was (for example "Civics"),
			without the rest of the address. The server only adds one to that page's count for the day. No
			identifier, IP address or other detail is stored with it, so the counts cannot be traced back
			to anyone.
		</p>
		<p>Legal basis: our legitimate interest in knowing which pages are used (GDPR Art. 6(1)(f)).</p>
	</section>

	<section>
		<h2>The one cookie, and only if you agree</h2>
		<p>
			On your first visit a bar asks whether we may count you as a returning visitor. Until you
			answer, no cookie is set.
		</p>
		<ul class="list-disc space-y-1 pl-5">
			<li>
				<strong>"OK"</strong> sets a cookie named <code>consent</code> that holds a random id and nothing
				else, for 13 months. With it, the server stores on which days that id visited, but not which pages.
				That tells us how many visitors come back. Legal basis: your consent (TDDDG § 25(1), GDPR Art.
				6(1)(a)). Stored days are deleted after 13 months.
			</li>
			<li>
				<strong>"No thanks"</strong> sets the same cookie to <code>no</code>, so that the bar does
				not ask again. Nothing else is stored. This is strictly necessary to remember your choice
				(TDDDG § 25(2) no. 2).
			</li>
		</ul>
		<p>
			You can withdraw your consent at any time:
			<button type="button" class="underline" onclick={reopen}>Cookie settings</button>
			(also at the bottom of every page). That deletes the cookie and every day stored for its id, and
			shows the bar again.
		</p>
	</section>

	<section>
		<h2>Links to other sites</h2>
		<p>
			The links to GitHub and Discord lead to other providers. Once you follow them, their privacy
			policies apply.
		</p>
	</section>

	<section>
		<h2>Your rights</h2>
		<p>
			You have the right to access, rectification, erasure and restriction of processing of your
			data, to data portability, and to object to processing based on legitimate interest (GDPR Art.
			15–18, 20, 21). A consent can be withdrawn at any time, with effect for the future (Art.
			7(3)). You can also complain to a data protection supervisory authority, for example the one
			where you live (Art. 77). Since we store no name, address or IP address, we can usually only
			identify data about you if you give us your cookie's id.
		</p>
	</section>
</main>
