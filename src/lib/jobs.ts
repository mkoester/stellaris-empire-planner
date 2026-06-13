// Shared formatting for job resources / job-swap tooltips (Civics + Origins pages).
import type { JobResource, JobSwap } from '$lib/server/db';

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const num = (n: number) => (Number.isInteger(n) ? n : parseFloat(n.toFixed(2)));

// "+3 Alloys, −6 Minerals" (produces = +, upkeep = −).
export function formatJobResources(resources: JobResource[]): string {
	return resources
		.map((r) => `${r.kind === 'produces' ? '+' : '−'}${num(r.amount)} ${titleCase(r.resource)}`)
		.join(', ');
}

// Tooltip for one swap: "Metallurgist (+3 Alloys, −6 Minerals) → Catalytic Technician (…)".
export function swapTitle(s: JobSwap): string {
	const base = formatJobResources(s.baseResources);
	const swapped = formatJobResources(s.swappedResources);
	const left = `${s.baseName ?? s.baseJob}${base ? ` (${base})` : ''}`;
	const right = `${s.swappedName ?? s.swappedJob}${swapped ? ` (${swapped})` : ''}`;
	return `${left}  →  ${right}`;
}

// Combined tooltip for all of a civic/origin's swaps (one per line).
export function swapsTooltip(swaps: JobSwap[]): string {
	return swaps.map(swapTitle).join('\n');
}
