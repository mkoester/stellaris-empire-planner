// "Help me choose" for a MegaCorp: what each branch office building gives the host colony and
// the corporation (its capital), and which civics add to which building. Holdings (an overlord's
// buildings on a subject) read the same way. Data: `loadOwnedBuildings()`.
import type { Civic, OwnedBuilding, OwnedBuildingEffect, Trigger } from '$lib/server/db';
import { leafKeys, triggerText } from '$lib/triggers';

export interface SplitEffects {
	colony: OwnedBuildingEffect[]; // always, on the host colony
	owner: OwnedBuildingEffect[]; // always, to the owner (a branch office's: its capital)
	byCivic: OwnedBuildingEffect[]; // only with an owner civic
	other: OwnedBuildingEffect[]; // under another condition
}

export function splitEffects(b: OwnedBuilding): SplitEffects {
	const gated = (e: OwnedBuildingEffect) => e.ownerCivic !== null || e.condition !== null;
	return {
		colony: b.effects.filter((e) => !gated(e) && e.scope === 'planet'),
		owner: b.effects.filter((e) => !gated(e) && e.scope === 'country'),
		byCivic: b.effects.filter((e) => e.ownerCivic !== null),
		other: b.effects.filter((e) => e.ownerCivic === null && e.condition !== null)
	};
}

export interface CivicBoost {
	civic: Civic;
	buildings: { building: OwnedBuilding; effects: OwnedBuildingEffect[] }[];
}

/** Each civic that adds to some of these buildings, with what it adds where; by civic name. */
export function civicBoosts(buildings: OwnedBuilding[], civics: Civic[]): CivicBoost[] {
	const byKey = new Map(civics.map((c) => [c.key, c]));
	const out = new Map<string, CivicBoost>();
	for (const building of buildings)
		for (const e of building.effects) {
			for (const key of e.ownerCivic ? [e.ownerCivic] : ownerCivics(e.condition)) {
				const civic = byKey.get(key);
				if (!civic) continue;
				const boost =
					out.get(civic.key) ?? out.set(civic.key, { civic, buildings: [] }).get(civic.key)!;
				const row = boost.buildings.find((x) => x.building.key === building.key);
				if (row) row.effects.push(e);
				else boost.buildings.push({ building, effects: [e] });
			}
		}
	return [...out.values()].sort((a, b) =>
		(a.civic.name ?? a.civic.key).localeCompare(b.civic.name ?? b.civic.key)
	);
}

/** A job modifier counts workforce (200 = two jobs), and shows it so, as the game's texts do
 * ("adds +200 Trader jobs"); the job count goes in the hover. */
export function jobCount(e: OwnedBuildingEffect): number | null {
	return /^job_\w+_add$/.test(e.modifier.key) ? e.modifier.value / 100 : null;
}

/** A gate in the game's trigger text, readable: "owner: is criminal syndicate". */
export const conditionText = (c: string) =>
	c
		.replace(/\bbranch_office_owner =/g, 'owner:')
		.replace(/\bplanet\.owner =/g, 'colony owner:')
		.replace(/\bexists = planet\.owner\s*/g, '')
		.replace(/ = yes\b/g, '')
		.replace(/_/g, ' ')
		.trim();

export interface BuildingJob {
	name: string; // as the game names the job: "Miner", "Medical Worker"
	adds: boolean; // the building gives such jobs (always, or with a civic or condition)
	boosts: boolean; // it adds to what such a job produces ("Trade Produced per 100 Miners")
}

const jobAdd = /^job_\w+_add$/;
const perJob = /^.* per 100 (.+)$/;

/** The jobs a building gives or adds to, by name, each once: its badges and job filter. */
export function buildingJobs(b: OwnedBuilding): BuildingJob[] {
	const out = new Map<string, BuildingJob>();
	const mark = (name: string, k: 'adds' | 'boosts') => {
		const j = out.get(name) ?? out.set(name, { name, adds: false, boosts: false }).get(name)!;
		j[k] = true;
	};
	for (const j of b.jobs) mark(j.name ?? j.job, 'adds');
	for (const e of b.effects) {
		const label = e.modifier.label ?? '';
		if (jobAdd.test(e.modifier.key) && label.endsWith(' Jobs')) mark(label.slice(0, -5), 'adds');
	}
	// "per 100 Miners" names the job in the plural: the singular of a job named above, if any
	for (const e of b.effects) {
		const plural = (e.modifier.label ?? '').match(perJob)?.[1];
		if (!plural || !/_produces_add$/.test(e.modifier.key)) continue;
		mark([...out.keys()].find((n) => `${n}s` === plural) ?? plural, 'boosts');
	}
	return [...out.values()];
}

/** Every job name across the buildings, sorted: the filter's choices. */
export const jobNames = (buildings: OwnedBuilding[]) =>
	[...new Set(buildings.flatMap((b) => buildingJobs(b).map((j) => j.name)))].sort();

/**
 * Who may build a branch office building, from its owner trigger (4.5.2
 * `common/scripted_triggers/00_scripted_triggers.txt`):
 * - `everyone`: no owner condition — every MegaCorp, Criminal Syndicates too;
 * - `legit`: `is_legit_or_legal_criminal` — every MegaCorp, a Criminal Syndicate only where it
 *   has a commercial pact, a federation or a subject tie with the host;
 * - `criminal`: `is_illegal_criminal` — a Criminal Syndicate without such a tie;
 * - `civic`: some civic or origin unlocks it (`unlockedBy`);
 * - `other`: anything else (a synth MegaCorp, a psionic tradition), as `needs`.
 * `needs` lists what else it takes: an excluded origin, techs, the host's pops.
 */
export type AccessKind = 'everyone' | 'legit' | 'criminal' | 'civic' | 'other';
export interface Access {
	kind: AccessKind;
	needs: string[];
}

const LEGIT = 'is_legit_or_legal_criminal';
const ILLEGAL = 'is_illegal_criminal';

export function access(b: OwnedBuilding, names: Record<string, string>): Access {
	const t = b.ownerTrigger;
	const top = t === null ? [] : 'leaf' in t || t.op !== 'and' ? [t] : t.args;
	const isLeaf = (x: Trigger, leaf: string) => 'leaf' in x && x.leaf === leaf && x.value === 'yes';
	const kind: AccessKind = b.unlockedBy.length
		? 'civic'
		: t === null
			? 'everyone'
			: top.some((x) => isLeaf(x, ILLEGAL))
				? 'criminal'
				: top.some((x) => isLeaf(x, LEGIT))
					? 'legit'
					: 'other';
	// the conditions besides the one that decides the kind (and the unlocking civics, named apart)
	const rest = top.filter(
		(x) =>
			!(kind === 'legit' && isLeaf(x, LEGIT)) &&
			!(kind === 'criminal' && isLeaf(x, ILLEGAL)) &&
			!(kind === 'civic' && leafKeys(x).every((k) => CIVIC_LEAVES.has(k)))
	);
	const needs = [
		...(kind === 'other'
			? [t ? triggerText(t, names) : '']
			: rest.map((x) => triggerText(x, names))),
		...b.techs.map((x) => x.name ?? x.key),
		...(b.allow ? [allowText(b.allow, names)] : [])
	].filter(Boolean);
	return { kind, needs };
}

const CIVIC_LEAVES = new Set([
	'has_valid_civic',
	'has_civic',
	'has_origin',
	'is_galvanic_empire',
	'is_criminal_syndicate'
]);

/** `allow` read for people: "25+ pops on the colony", "an upgraded capital". */
function allowText(t: Trigger, names: Record<string, string>): string {
	if ('leaf' in t) {
		if (t.leaf === 'pop_amount' && t.cmp === '>=') return `${Number(t.value) / 100}+ pops`;
		if (t.leaf === 'has_major_upgraded_capital') return 'an upgraded capital';
		if (t.value === 'scope') return '';
		return triggerText(t, names);
	}
	if (t.op === 'and')
		return t.args
			.map((a) => allowText(a, names))
			.filter(Boolean)
			.join(', ');
	return triggerText(t, names);
}

/**
 * The civics that add to a building, each once, in file order: a block gated on one civic, and
 * the civics a gate's owner part names (`branch_office_owner = OR = has_valid_civic = A B`; 4.5.2
 * Fast Food Chain's Anglers). The host's owner (`owner = …`, before it) is not ours.
 */
export const boostingCivics = (b: OwnedBuilding): string[] => [
	...new Set(b.effects.flatMap((e) => (e.ownerCivic ? [e.ownerCivic] : ownerCivics(e.condition))))
];

function ownerCivics(condition: string | null): string[] {
	const at = condition?.indexOf('branch_office_owner =') ?? -1;
	if (at < 0) return [];
	const part = condition!.slice(at);
	return /\bNO[RT]\b/.test(part) ? [] : (part.match(/\bcivic_\w+/g) ?? []);
}
