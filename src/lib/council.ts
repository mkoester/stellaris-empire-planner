// "Help me choose": every council seat a civic opens, as rows to compare and filter.
import type { Civic, CouncilPosition } from '#lib/server/db/index.ts';
import { civicTypeLabel, modifierLabel } from '#lib/civics.ts';

export interface CouncilSeatRow {
	seat: CouncilPosition;
	civic: Civic;
	group: string; // the civic's type label: Regular, Gestalt, Corporate, Special
	search: string; // lower-case text the filter matches: seat, civic, classes, effects
}

export type SeatSort = 'seat' | 'civic' | 'group';

/** Seats of the civics given, filtered by text and leader class, sorted. */
export function councilSeatRows(
	civics: Civic[],
	council: Record<string, CouncilPosition>,
	opts: { query?: string; leaderClass?: string | null; sort?: SeatSort } = {}
): CouncilSeatRow[] {
	const q = (opts.query ?? '').trim().toLowerCase();
	const rows = civics.flatMap((civic) => {
		const seat = council[civic.key];
		if (!seat) return [];
		const search = [
			seat.name ?? seat.key,
			civic.name ?? civic.key,
			...seat.leaderClasses,
			...seat.modifiers.map(modifierLabel),
			seat.effect ?? ''
		]
			.join(' ')
			.toLowerCase();
		return [{ seat, civic, group: civicTypeLabel(civic.civicType), search }];
	});
	const name = (r: CouncilSeatRow) => r.seat.name ?? r.seat.key;
	const civicName = (r: CouncilSeatRow) => r.civic.name ?? r.civic.key;
	const by: Record<SeatSort, (a: CouncilSeatRow, b: CouncilSeatRow) => number> = {
		seat: (a, b) => name(a).localeCompare(name(b)),
		civic: (a, b) => civicName(a).localeCompare(civicName(b)),
		group: (a, b) => a.group.localeCompare(b.group) || name(a).localeCompare(name(b))
	};
	return rows
		.filter((r) => !q || r.search.includes(q))
		.filter((r) => !opts.leaderClass || r.seat.leaderClasses.includes(opts.leaderClass))
		.sort(by[opts.sort ?? 'seat']);
}

/** Every leader class some seat takes, sorted. */
export const seatClasses = (council: Record<string, CouncilPosition>): string[] =>
	[...new Set(Object.values(council).flatMap((s) => s.leaderClasses))].sort();
