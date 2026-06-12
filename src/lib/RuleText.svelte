<script lang="ts">
	// Render an effect description whose rules are newline-separated (preserved from
	// the game tooltip). Layout follows the global setting: inline " | " or one per
	// line. A single-rule (prose) description just renders as a paragraph.
	import { settings } from '$lib/settings.svelte';

	let { text, class: cls = '' }: { text: string; class?: string } = $props();

	const rules = $derived(
		text
			.split('\n')
			.map((r) => r.replace(/^[-•]\s*/, '').trim())
			.filter(Boolean)
	);
</script>

{#if rules.length <= 1}
	<p class={cls}>{rules[0] ?? ''}</p>
{:else if settings.ruleLayout === 'lines'}
	<ul class="{cls} list-disc space-y-0.5 pl-4">
		{#each rules as r, i (i)}<li>{r}</li>{/each}
	</ul>
{:else}
	<p class={cls}>{rules.join(' | ')}</p>
{/if}
