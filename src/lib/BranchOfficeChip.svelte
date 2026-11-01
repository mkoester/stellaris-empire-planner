<script lang="ts">
	// The branch office buildings a civic adds to, as a chip with a popup: per building, what the
	// civic adds there. The full table is on "Help me choose".
	import type { CivicBoost } from '$lib/branchOffices';
	import { formatModifierValue, modifierColor, modifierLabel } from '$lib/civics';
	import { jobCount } from '$lib/branchOffices';
	import InfoPopup from '$lib/InfoPopup.svelte';

	let { boost }: { boost: CivicBoost } = $props();
	const num = (n: number) => (Number.isInteger(n) ? n : parseFloat(n.toFixed(2)));
</script>

<InfoPopup class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-200/90">
	Branch offices: {boost.buildings.length}
	{#snippet content()}
		<div>
			<div class="text-sm font-semibold">Branch offices</div>
			<div class="opacity-55">What this civic adds to your branch office buildings</div>
		</div>
		{#each boost.buildings as row (row.building.key)}
			<div class="space-y-0.5">
				<div class="font-medium">{row.building.name ?? row.building.key}</div>
				<ul class="space-y-0.5">
					{#each row.effects as e, i (i)}
						{@const jobs = jobCount(e)}
						<li class="flex items-baseline justify-between gap-3">
							<span class="opacity-70"
								><span class="opacity-60">{e.scope === 'planet' ? 'colony' : 'capital'}:</span>
								{modifierLabel(e.modifier)}</span
							>
							<span
								class="shrink-0 font-mono {modifierColor(e.modifier)}"
								title={jobs === null
									? undefined
									: `${num(e.modifier.value)} workforce: ${num(jobs)} job${jobs === 1 ? '' : 's'}`}
								>{formatModifierValue(e.modifier)}</span
							>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	{/snippet}
</InfoPopup>
