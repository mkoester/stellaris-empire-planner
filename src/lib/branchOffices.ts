// "Help me choose" for a MegaCorp: what each branch office building gives the host colony and
// the corporation (its capital), and which civics add to which building. Holdings (an overlord's
// buildings on a subject) read the same way. Data: `loadOwnedBuildings()`.
import type { Civic, OwnedBuilding, OwnedBuildingEffect } from '$lib/server/db';

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
			const civic = e.ownerCivic ? byKey.get(e.ownerCivic) : undefined;
			if (!civic) continue;
			const boost =
				out.get(civic.key) ?? out.set(civic.key, { civic, buildings: [] }).get(civic.key)!;
			const row = boost.buildings.find((x) => x.building.key === building.key);
			if (row) row.effects.push(e);
			else boost.buildings.push({ building, effects: [e] });
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
