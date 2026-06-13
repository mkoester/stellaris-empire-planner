<script lang="ts">
	import type { PageData } from './$types';
	import { empire } from '$lib/empire.svelte';

	let { data }: { data: PageData } = $props();
	const flagAssets = $derived(data.flagAssets);
	const flagColors = $derived(data.flagColors);
	const colorHex = $derived(new Map(flagColors.map((c) => [c.key, c.hex])));
	const flag = $derived(empire.draft.flag);
</script>

<main class="mx-auto max-w-3xl space-y-4 p-4">
	<div class="space-y-1">
		<h1 class="text-2xl font-bold">Flag</h1>
		<p class="text-sm opacity-60">
			Icon &amp; background are <code>.dds</code> assets (no in-browser preview) — chosen by name; the
			colours show swatches.
		</p>
	</div>

	<section class="border-surface-400-500/30 space-y-3 rounded-lg border p-4">
		<div class="flex items-center justify-end">
			{#if flag}
				<button class="btn preset-filled text-xs" onclick={() => empire.removeFlag()}>
					Remove flag
				</button>
			{:else}
				<button class="btn preset-filled-primary-500 text-sm" onclick={() => empire.addFlag()}>
					Add flag
				</button>
			{/if}
		</div>

		{#if flag}
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1 text-sm">
					<span class="opacity-60">Icon category</span>
					<select
						class="select"
						value={flag.iconCategory ?? ''}
						onchange={(e) =>
							empire.updateFlag({ iconCategory: e.currentTarget.value || null, iconFile: null })}
					>
						<option value="">—</option>
						{#each flagAssets.categories as c (c)}<option value={c}>{c}</option>{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					<span class="opacity-60">Icon file</span>
					<select
						class="select"
						value={flag.iconFile ?? ''}
						disabled={!flag.iconCategory}
						onchange={(e) => empire.updateFlag({ iconFile: e.currentTarget.value || null })}
					>
						<option value="">—</option>
						{#each flag.iconCategory ? (flagAssets.iconsByCategory[flag.iconCategory] ?? []) : [] as f (f)}
							<option value={f}>{f}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					<span class="opacity-60">Background</span>
					<select
						class="select"
						value={flag.backgroundFile ?? ''}
						onchange={(e) =>
							empire.updateFlag({
								backgroundCategory: 'backgrounds',
								backgroundFile: e.currentTarget.value || null
							})}
					>
						<option value="">—</option>
						{#each flagAssets.backgrounds as f (f)}<option value={f}>{f}</option>{/each}
					</select>
				</label>
			</div>

			<div class="space-y-1">
				<span class="text-xs opacity-60">Colours</span>
				<div class="flex flex-wrap gap-3">
					{#each [0, 1, 2, 3] as i (i)}
						<div class="flex items-center gap-1.5">
							<span
								class="border-surface-400-500/40 inline-block h-5 w-5 shrink-0 rounded border"
								style="background-color: {colorHex.get(flag.colors[i]) ?? 'transparent'}"
							></span>
							<select
								class="select text-sm"
								value={flag.colors[i] ?? 'null'}
								onchange={(e) => empire.setFlagColor(i, e.currentTarget.value)}
							>
								<option value="null">—</option>
								{#each flagColors as c (c.key)}<option value={c.key}>{c.key}</option>{/each}
							</select>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</section>
</main>
