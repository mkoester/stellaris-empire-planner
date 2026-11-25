<script lang="ts">
	// Two equal buttons: refusing must be as easy as accepting, or the consent is not valid.
	// No cookie exists before a click.
	import { answer, consent } from '#lib/consent.svelte.ts';
	import { resolve } from '$app/paths';
</script>

{#if consent.open}
	<div
		class="border-surface-400-500/30 fixed inset-x-0 bottom-0 z-50 border-t bg-surface-50-950/95 backdrop-blur"
		role="dialog"
		aria-label="Cookie consent"
	>
		<div class="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-sm">
			<p class="min-w-0 flex-1">
				May we set one cookie to count returning visitors? It holds a random id and nothing else.
				Page views are counted anonymously either way.
				<a href={resolve('/privacy')} class="underline">Privacy policy</a>
			</p>
			<div class="flex gap-2">
				<button
					type="button"
					class="btn min-w-24 preset-filled-primary-500"
					onclick={() => answer(true)}
				>
					OK
				</button>
				<button
					type="button"
					class="btn min-w-24 preset-filled-primary-500"
					onclick={() => answer(false)}
				>
					No thanks
				</button>
			</div>
		</div>
	</div>
{/if}
