<script lang="ts">
	// A builder pick (card or chip) that toggles on click. A <div>, not a <button>: a button may
	// hold neither block content nor the chips, popups and buttons the cards carry, and the
	// browser repairs such HTML until hydration no longer matches it. The keyboard reaches the
	// pick through a visually hidden button whose click bubbles up to the card's handler.
	// `debug` (DEBUG_DISABLE_SELECTION) leaves plain, selectable text.
	import type { Snippet } from 'svelte';

	let {
		selected,
		label,
		onToggle,
		debug = false,
		class: cls = '',
		children,
		...rest
	}: {
		selected: boolean;
		label: string;
		onToggle: () => void;
		debug?: boolean;
		class?: string;
		children: Snippet;
		// a Tip trigger's attributes (aria-describedby, pointer handlers, …), and id/style
		[attr: string]: unknown;
	} = $props();
</script>

{#if debug}
	<div {...rest} class="relative {cls} cursor-text select-text">{@render children()}</div>
{:else}
	<!-- Mouse: the whole card. Keyboard: the hidden button below, whose click bubbles here. -->
	<div
		{...rest}
		class="relative {cls} select-none has-[>button:focus-visible]:outline-2 has-[>button:focus-visible]:outline-offset-2"
		onclick={onToggle}
	>
		<button type="button" class="sr-only" aria-pressed={selected} aria-label={label}></button>
		{@render children()}
	</div>
{/if}
