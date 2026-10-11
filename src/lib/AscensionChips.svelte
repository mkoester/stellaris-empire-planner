<script lang="ts">
	// An origin's or civic's ascension-path gate as chips: locked to one path, some paths
	// blocked, or — all four blocked (Natural Design) — no ascension at all.
	import Tip from '$lib/Tip.svelte';
	import { ASCENSION_PATHS } from '$lib/compat';
	let { lock, blocks }: { lock: string | null; blocks: string[] } = $props();
	const none = $derived(!lock && ASCENSION_PATHS.every((p) => blocks.includes(p)));
	const chip =
		'rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-200';
</script>

{#if lock}
	<Tip text="Locked to {lock} Ascension — blocks all other ascension paths" class={chip}>
		{lock} ascension only
	</Tip>
{:else if none}
	<Tip text="Blocks every ascension path (Genetic, Cybernetic, Synthetic, Psionic)" class={chip}>
		no ascension
	</Tip>
{:else}
	{#each blocks as path (path)}
		<Tip text="Cannot pursue {path} Ascension" class={chip}>no {path} ascension</Tip>
	{/each}
{/if}
