<script lang="ts">
	import type { PageData } from './$types';
	import { empire } from '$lib/empire.svelte';

	let { data }: { data: PageData } = $props();
	const rooms = $derived(data.rooms);
	const draft = $derived(empire.draft);
	// Empty draft.room means the default room is used.
	const selected = $derived(draft.room || 'default_room');
</script>

<main class="mx-auto max-w-3xl space-y-4 p-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Room</h1>
		<p class="text-sm opacity-60">
			The diplomacy-room backdrop shown behind your ruler. Purely cosmetic; defaults to the standard
			room.
		</p>
	</div>

	<section class="border-surface-400-500/30 rounded-lg border p-4">
		<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each rooms as room (room.key)}
				<button
					type="button"
					aria-pressed={selected === room.key}
					onclick={() => empire.setRoom(room.key === 'default_room' ? '' : room.key)}
					class="rounded border px-3 py-2 text-left text-sm transition-colors {selected === room.key
						? 'border-primary-500 bg-primary-500/10'
						: 'border-surface-400-500/30 hover:border-surface-400-500/60'}"
				>
					{room.label ?? room.key}
				</button>
			{/each}
		</div>
	</section>
</main>
