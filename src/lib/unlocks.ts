// Council agendas and edicts that a civic, an origin or an authority opens: read from each one's
// `potential`/`allow` trigger (requirements only — a `not` is an exclusion, not an unlock).
// Scripted triggers the extraction keeps as leaves are resolved here, after the game's
// `common/scripted_triggers/00_scripted_triggers.txt` (4.5.2).
import type { Trigger } from '$lib/server/db';
import type { ConditionalModifier } from '$lib/server/db';
import { positiveLeaves } from '$lib/triggers';

export type PickKind = 'civic' | 'origin' | 'authority';
export type Pick = { kind: PickKind; key: string };

export interface Unlock {
	kind: 'agenda' | 'edict';
	key: string;
	name: string;
	description: string | null;
	potential: Trigger | null;
	allow: Trigger | null;
	modifiers: ConditionalModifier[]; // an edict's while active, an agenda's while launching
	finish: ConditionalModifier[]; // an agenda's once launched
	picks: Pick[];
	needNames: Record<string, string>; // traditions and ascension perks its trigger names
}

const SCRIPTED: Record<string, Pick[]> = {
	is_death_cult_empire: [
		{ kind: 'civic', key: 'civic_death_cult' },
		{ kind: 'civic', key: 'civic_death_cult_corporate' }
	],
	is_megacorp: [{ kind: 'authority', key: 'auth_corporate' }],
	is_democratic_authority: [{ kind: 'authority', key: 'auth_democratic' }],
	is_oligarchic_authority: [{ kind: 'authority', key: 'auth_oligarchic' }],
	is_dictatorial_authority: [{ kind: 'authority', key: 'auth_dictatorial' }],
	is_imperial_authority: [{ kind: 'authority', key: 'auth_imperial' }]
};

/** The picks a trigger requires (any of them), each once. */
export function picksIn(...ts: (Trigger | null)[]): Pick[] {
	const out = new Map<string, Pick>();
	const add = (p: Pick) => out.set(`${p.kind}:${p.key}`, p);
	for (const t of ts) {
		for (const leaf of ['has_valid_civic', 'has_civic'])
			positiveLeaves(t, leaf).forEach((key) => add({ kind: 'civic', key }));
		positiveLeaves(t, 'has_origin').forEach((key) => add({ kind: 'origin', key }));
		positiveLeaves(t, 'has_authority').forEach((key) => add({ kind: 'authority', key }));
		for (const [leaf, picks] of Object.entries(SCRIPTED))
			if (positiveLeaves(t, leaf).includes('yes')) picks.forEach(add);
	}
	return [...out.values()];
}

/** The unlocks per pick, keyed "kind:key". */
export function unlocksByPick(unlocks: Unlock[]): Record<string, Unlock[]> {
	const out: Record<string, Unlock[]> = {};
	for (const u of unlocks) for (const p of u.picks) (out[`${p.kind}:${p.key}`] ??= []).push(u);
	return out;
}
