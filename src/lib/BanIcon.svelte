<script lang="ts">
	// "No entry" / not-allowed sign — marks the per-card exclusions toggle on Civics/Origins.
	let { size = 12, class: cls = '' }: { size?: number; class?: string } = $props();
</script>

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
	class="inline {cls}"
	aria-hidden="true"
>
	<circle cx="12" cy="12" r="10" />
	<path d="m4.9 4.9 14.2 14.2" />
</svg>
