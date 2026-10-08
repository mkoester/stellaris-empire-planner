<script lang="ts">
	// Authority + flag chips for an EmpireProfile. Used by the global filter bar (all axes)
	// and by each tradition tree's own switcher (only the axes that tree branches on).
	import Tip from '$lib/Tip.svelte';
	import {
		AUTHORITIES,
		FLAGS,
		flagAllowed,
		toggleFlag,
		withAuthority,
		type Authority,
		type EmpireProfile,
		type ProfileFlag
	} from '$lib/triggers';

	let {
		profile,
		onchange,
		authorities = AUTHORITIES.map((a) => a.key),
		flags = FLAGS.map((f) => f.key),
		small = false
	}: {
		profile: EmpireProfile;
		onchange: (p: EmpireProfile) => void;
		authorities?: Authority[];
		flags?: ProfileFlag[];
		small?: boolean;
	} = $props();

	const size = $derived(small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs');
	const chip = (on: boolean) =>
		on ? 'preset-filled-primary-500' : 'preset-tonal hover:preset-filled-surface-500';
</script>

<div class="flex flex-wrap items-center gap-1">
	{#each AUTHORITIES.filter((a) => authorities.includes(a.key)) as a (a.key)}
		<button
			class="rounded {size} {chip(profile.authority === a.key)}"
			aria-pressed={profile.authority === a.key}
			onclick={() => onchange(withAuthority(profile, profile.authority === a.key ? null : a.key))}
		>
			{a.label}
		</button>
	{/each}
	{#if authorities.length && flags.length}
		<span class="mx-0.5 opacity-30">|</span>
	{/if}
	{#each FLAGS.filter((f) => flags.includes(f.key)) as f (f.key)}
		{@const allowed = flagAllowed(profile, f.key)}
		<Tip
			text={allowed
				? ''
				: `${f.label} is ${AUTHORITIES.find((a) => a.key === f.only)?.label} only — selecting it switches`}
		>
			{#snippet trigger(a)}
				<button
					{...a}
					class="rounded {size} {chip(profile.flags.includes(f.key))} {allowed ? '' : 'opacity-40'}"
					aria-pressed={profile.flags.includes(f.key)}
					onclick={() => onchange(toggleFlag(profile, f.key))}
				>
					{f.label}
				</button>
			{/snippet}
		</Tip>
	{/each}
</div>
