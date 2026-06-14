// Shared formatting for job resources / modifiers / job-swap tooltips (Civics + Origins + Jobs).
import type { JobResource, JobSwap, Modifier } from '$lib/server/db';
import { formatModifierValue, modifierLabel } from '$lib/civics';

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const num = (n: number) => (Number.isInteger(n) ? n : parseFloat(n.toFixed(2)));

// "+3 Alloys, −6 Minerals" (produces = +, upkeep = −).
export function formatJobResources(resources: JobResource[]): string {
	return resources
		.map((r) => `${r.kind === 'produces' ? '+' : '−'}${num(r.amount)} ${titleCase(r.resource)}`)
		.join(', ');
}

// "−25 Crime, +0.2 Stability, +10% Ethics Attraction" — the job's non-resource effects,
// formatted with the same label/percentage rules the civics & origins pages use.
export function formatJobModifiers(mods: Modifier[]): string {
	// Use the same − glyph as resources for a leading minus (formatModifierValue emits ASCII -).
	return mods
		.map((m) => `${formatModifierValue(m).replace(/^-/, '−')} ${modifierLabel(m)}`)
		.join(', ');
}

// One side of a swap: resources then modifiers, comma-joined ("" when a job has neither).
function sideEffects(resources: JobResource[], mods: Modifier[]): string {
	return [formatJobResources(resources), formatJobModifiers(mods)].filter(Boolean).join(', ');
}

// Tooltip for one swap: "Enforcer (−25 Crime, …) → Educator (+2.5 Unity, −20 Crime, …)".
export function swapTitle(s: JobSwap): string {
	const base = sideEffects(s.baseResources, s.baseModifiers);
	const swapped = sideEffects(s.swappedResources, s.swappedModifiers);
	const left = `${s.baseName ?? s.baseJob}${base ? ` (${base})` : ''}`;
	const right = `${s.swappedName ?? s.swappedJob}${swapped ? ` (${swapped})` : ''}`;
	return `${left}  →  ${right}`;
}

// Combined tooltip for all of a civic/origin's swaps (one per line).
export function swapsTooltip(swaps: JobSwap[]): string {
	return swaps.map(swapTitle).join('\n');
}
