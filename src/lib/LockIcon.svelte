<script lang="ts">
	// The brass/metallic padlock marking civics that can't be added or removed after the
	// game starts (`modification = no`). One source of truth — used on the Civics cards,
	// the Empire summary and the floating overview. Tooltip via the shared Tip (Skeleton).
	import Tip from '$lib/Tip.svelte';
	let {
		class: cls = '',
		size = 12,
		title = 'Cannot be added or removed after game start'
	}: { class?: string; size?: number; title?: string } = $props();
</script>

<Tip text={title}>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="inline text-amber-400/90 drop-shadow-[0_1px_0_rgba(110,75,0,0.65)] {cls}"
		role="img"
		aria-label={title}
	>
		<rect x="3" y="11" width="18" height="11" rx="2" />
		<path d="M7 11V7a5 5 0 0 1 10 0v4" />
	</svg>
</Tip>
