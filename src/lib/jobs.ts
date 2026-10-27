// Structured diff for the civic/origin job-swap table tooltips (and shared num/titleCase).
import type { JobResource, JobSwap, Modifier, WorkedJobRow } from '$lib/server/db';
import { formatModifierValue, modifierLabel, modifierColor } from '$lib/civics';

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const num = (n: number) => (Number.isInteger(n) ? n : parseFloat(n.toFixed(2)));

// ── Structured diff for the table tooltip ──────────────────────────────────────
// Each swap becomes a 2-row table (original / replacement); columns are the input/output
// stats that actually change — added, removed or different value — so unchanged stats
// (and pure renames) don't clutter the view.

export interface SwapCell {
	text: string; // "+3", "−6", "+10%", or "—" when absent on this side
	cls: string; // colour class (green/red), or muted for an absent cell
}
export interface SwapColumn {
	label: string; // "Alloys", "Crime", …
	base: SwapCell;
	swapped: SwapCell;
}
export interface SwapTableData {
	baseName: string;
	swappedName: string;
	columns: SwapColumn[];
}

interface Stat {
	key: string; // stable column id (r:<resource> | m:<modifier>)
	label: string;
	cmp: number; // signed magnitude used to detect a change
	text: string;
	cls: string;
}

function resourceStat(r: JobResource): Stat {
	const produces = r.kind === 'produces';
	return {
		key: `r:${r.resource}`,
		label: titleCase(r.resource),
		cmp: produces ? r.amount : -r.amount,
		text: `${produces ? '+' : '−'}${num(r.amount)}`,
		cls: produces ? 'text-emerald-400' : 'text-red-400'
	};
}
function modifierStat(m: Modifier): Stat {
	return {
		key: `m:${m.key}`,
		label: modifierLabel(m),
		cmp: m.value,
		text: formatModifierValue(m).replace(/^-/, '−'),
		cls: modifierColor(m)
	};
}

const ABSENT: SwapCell = { text: '—', cls: 'opacity-30' };

// Build the 2-row diff table for one swap.
export function swapTable(s: JobSwap): SwapTableData {
	const baseStats = [...s.baseResources.map(resourceStat), ...s.baseModifiers.map(modifierStat)];
	const swapStats = [
		...s.swappedResources.map(resourceStat),
		...s.swappedModifiers.map(modifierStat)
	];
	const baseBy = new Map(baseStats.map((st) => [st.key, st]));
	const swapBy = new Map(swapStats.map((st) => [st.key, st]));
	const order: string[] = [];
	for (const st of [...baseStats, ...swapStats]) if (!order.includes(st.key)) order.push(st.key);

	const columns: SwapColumn[] = [];
	for (const key of order) {
		const b = baseBy.get(key);
		const w = swapBy.get(key);
		if ((b?.cmp ?? null) === (w?.cmp ?? null)) continue; // unchanged → skip
		columns.push({
			label: (b ?? w)!.label,
			base: b ? { text: b.text, cls: b.cls } : ABSENT,
			swapped: w ? { text: w.text, cls: w.cls } : ABSENT
		});
	}
	return {
		baseName: s.baseName ?? s.baseJob,
		swappedName: s.swappedName ?? s.swappedJob,
		columns
	};
}

// ── A building's jobs, worked ──────────────────────────────────────────────────
// Jobs come in workforce (job_<x>_add = 200 is two jobs' worth); a job's output is per 100.
export const JOB_WORKFORCE = 100;

// What a building's jobs produce net of their upkeep when all are filled, base values
// (no modifiers), largest first; resources that cancel out are dropped.
export function workedOutput(jobs: WorkedJobRow[]): { resource: string; amount: number }[] {
	const net = new Map<string, number>();
	for (const j of jobs)
		for (const r of j.resources)
			net.set(
				r.resource,
				(net.get(r.resource) ?? 0) +
					((r.kind === 'produces' ? 1 : -1) * r.amount * j.amount) / JOB_WORKFORCE
			);
	return [...net]
		.map(([resource, amount]) => ({ resource, amount: Math.round(amount * 100) / 100 }))
		.filter((r) => r.amount !== 0)
		.sort((a, b) => b.amount - a.amount);
}
