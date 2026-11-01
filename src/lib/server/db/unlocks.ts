// Council agendas and edicts a civic, origin or authority opens (#lib/unlocks.ts). Only those:
// the rest come from traditions and ascension perks, shown on their own pages.
import { db } from './client';
import { loadModifiers } from './traditions';
import type { Trigger } from './traditions';
import { picksIn, type Unlock } from '$lib/unlocks';

const leafValues = (...ts: (Trigger | null)[]): string[] =>
	ts.flatMap((t) => (t === null ? [] : 'leaf' in t ? [t.value] : leafValues(...t.args)));

const parse = (s: string | null): Trigger | null => (s === null ? null : JSON.parse(s));

export function loadPickUnlocks(): Unlock[] {
	const d = db();
	const mods = loadModifiers();
	// what else they need names traditions and ascension perks, too
	const needNames = loadTraditionPerkNames();
	const rows = [
		...(
			d
				.prepare(
					`SELECT key, name, description, potential_json, allow_json FROM council_agenda
					 ORDER BY sort_order`
				)
				.all() as Row[]
		).map((r) => ({ ...r, kind: 'agenda' as const })),
		...(
			d
				.prepare(
					`SELECT key, name, description, potential_json, allow_json FROM edict
					 ORDER BY sort_order`
				)
				.all() as Row[]
		).map((r) => ({ ...r, kind: 'edict' as const }))
	];
	// a variant the game leaves unnamed (agenda_organo_machine_interfacing_assimilator, 4.5.2)
	// takes its base's name
	const named = new Map(rows.flatMap((r) => (r.name ? [[r.key, r.name] as const] : [])));
	const nameOf = (key: string): string => {
		for (let k = key; k.includes('_'); k = k.slice(0, k.lastIndexOf('_')))
			if (named.has(k)) return named.get(k)!;
		return key;
	};
	return rows.flatMap((r) => {
		const [potential, allow] = [parse(r.potential_json), parse(r.allow_json)];
		const picks = picksIn(potential, allow);
		if (!picks.length) return [];
		return [
			{
				kind: r.kind,
				key: r.key,
				name: nameOf(r.key),
				description: r.description || null,
				potential,
				allow,
				modifiers: mods.get(r.key) ?? [],
				finish: mods.get(`${r.key}#finish`) ?? [],
				picks,
				needNames: Object.fromEntries(
					leafValues(potential, allow).flatMap((k) => (needNames[k] ? [[k, needNames[k]]] : []))
				)
			}
		];
	});
}

type Row = {
	key: string;
	name: string | null;
	description: string | null;
	potential_json: string | null;
	allow_json: string | null;
};

/** Tradition and ascension perk names by key, for requirement texts. */
export function loadTraditionPerkNames(): Record<string, string> {
	const rows = db()
		.prepare(
			`SELECT key, name FROM tradition WHERE name IS NOT NULL
			 UNION ALL SELECT key, name FROM ascension_perk WHERE name IS NOT NULL`
		)
		.all() as Array<{ key: string; name: string }>;
	return Object.fromEntries(rows.map((r) => [r.key, r.name]));
}
