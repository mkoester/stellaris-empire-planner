// Pop jobs, job swaps, reference buildings.
import { db } from './client';
import type { Modifier } from './types';

export interface JobResource {
	kind: 'produces' | 'upkeep';
	resource: string; // e.g. "minerals"
	amount: number;
}
export interface Job {
	key: string;
	name: string | null;
	category: string | null; // worker | specialist | ruler | complex_drone | …
	description: string | null;
	resources: JobResource[]; // base produced/upkeep (empty for modifier-only jobs)
	modifiers: Modifier[]; // non-resource effects: Amenities, Crime, Stability, Naval cap, …
}

export function loadJobs(): Job[] {
	const d = db();
	const rows = d
		.prepare('SELECT key, name, category, description FROM job ORDER BY sort_order')
		.all() as Array<{
		key: string;
		name: string | null;
		category: string | null;
		description: string | null;
	}>;
	const resRows = d
		.prepare(
			'SELECT job_key, kind, resource, amount FROM job_resource ORDER BY job_key, kind, sort_order'
		)
		.all() as Array<{ job_key: string; kind: string; resource: string; amount: number }>;
	const byJob = new Map<string, JobResource[]>();
	for (const r of resRows) {
		if (!byJob.has(r.job_key)) byJob.set(r.job_key, []);
		byJob.get(r.job_key)!.push({
			kind: r.kind as JobResource['kind'],
			resource: r.resource,
			amount: r.amount
		});
	}
	const modRows = d
		.prepare(
			`SELECT jm.job_key, jm.modifier, jm.value, ml.label, ml.positive_is_good
			 FROM job_modifier jm
			 LEFT JOIN modifier_label ml ON ml.modifier_key = jm.modifier
			 ORDER BY jm.job_key, jm.sort_order`
		)
		.all() as Array<{
		job_key: string;
		modifier: string;
		value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const modsByJob = new Map<string, Modifier[]>();
	for (const r of modRows) {
		if (!modsByJob.has(r.job_key)) modsByJob.set(r.job_key, []);
		modsByJob.get(r.job_key)!.push({
			key: r.modifier,
			value: r.value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}
	return rows.map((r) => ({
		...r,
		resources: byJob.get(r.key) ?? [],
		modifiers: modsByJob.get(r.key) ?? []
	}));
}

// ── Job swaps (civic/origin replaces a job) ────────────────────────────────────

export interface JobSwap {
	baseJob: string;
	baseName: string | null;
	swappedJob: string;
	swappedName: string | null;
	baseResources: JobResource[];
	swappedResources: JobResource[];
	baseModifiers: Modifier[];
	swappedModifiers: Modifier[];
}

// Job replacements keyed by the civic/origin that triggers them (e.g. Catalytic
// Processing → Metallurgist replaced by Catalytic Technician), with each job's base/swapped
// resources AND modifiers for the tooltip. For the Civics / Origins pages.
export function loadJobSwapsBySource(): Record<string, JobSwap[]> {
	const d = db();
	// Both sides of each swap's resources, evaluated for the plain empire (side='base') and
	// with the swap active (side='swapped'), keyed source|base|swapped|side. The swapped job
	// (and some base jobs, e.g. enforcer) have no row of their own in job_resource.
	const resBySide = new Map<string, JobResource[]>();
	for (const r of d
		.prepare(
			'SELECT source_key, base_job, swapped_job, side, kind, resource, amount FROM job_swap_resource'
		)
		.all() as Array<{
		source_key: string;
		base_job: string;
		swapped_job: string;
		side: string;
		kind: string;
		resource: string;
		amount: number;
	}>) {
		const k = `${r.source_key}|${r.base_job}|${r.swapped_job}|${r.side}`;
		if (!resBySide.has(k)) resBySide.set(k, []);
		resBySide.get(k)!.push({
			kind: r.kind as JobResource['kind'],
			resource: r.resource,
			amount: r.amount
		});
	}
	// Same, for each side's non-resource modifiers (joined to modifier_label for display).
	const modBySide = new Map<string, Modifier[]>();
	for (const r of d
		.prepare(
			`SELECT jsm.source_key, jsm.base_job, jsm.swapped_job, jsm.side, jsm.modifier, jsm.value,
			        ml.label, ml.positive_is_good
			 FROM job_swap_modifier jsm
			 LEFT JOIN modifier_label ml ON ml.modifier_key = jsm.modifier`
		)
		.all() as Array<{
		source_key: string;
		base_job: string;
		swapped_job: string;
		side: string;
		modifier: string;
		value: number;
		label: string | null;
		positive_is_good: number | null;
	}>) {
		const k = `${r.source_key}|${r.base_job}|${r.swapped_job}|${r.side}`;
		if (!modBySide.has(k)) modBySide.set(k, []);
		modBySide.get(k)!.push({
			key: r.modifier,
			value: r.value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}
	const rows = d
		.prepare(
			`SELECT source_key, base_job, base_name, swapped_job, swapped_name
			 FROM job_swap ORDER BY source_key, sort_order`
		)
		.all() as Array<{
		source_key: string;
		base_job: string;
		base_name: string | null;
		swapped_job: string;
		swapped_name: string | null;
	}>;
	const out: Record<string, JobSwap[]> = {};
	const seen: Record<string, Set<string>> = {};
	for (const r of rows) {
		const base = `${r.source_key}|${r.base_job}|${r.swapped_job}|base`;
		const swapped = `${r.source_key}|${r.base_job}|${r.swapped_job}|swapped`;
		const swap: JobSwap = {
			baseJob: r.base_job,
			baseName: r.base_name,
			swappedJob: r.swapped_job,
			swappedName: r.swapped_name,
			baseResources: resBySide.get(base) ?? [],
			swappedResources: resBySide.get(swapped) ?? [],
			baseModifiers: modBySide.get(base) ?? [],
			swappedModifiers: modBySide.get(swapped) ?? []
		};
		// De-duplicate by what the tooltip actually shows: several distinct base jobs can
		// share a display name and swapped target (e.g. enforcer + dystopian_enforcer both
		// render "Enforcer → Educator"). Keep distinct name/resource/modifier combos.
		const sig = JSON.stringify([
			swap.baseName ?? swap.baseJob,
			swap.swappedName ?? swap.swappedJob,
			swap.baseResources,
			swap.swappedResources,
			swap.baseModifiers,
			swap.swappedModifiers
		]);
		seen[r.source_key] ??= new Set();
		if (seen[r.source_key].has(sig)) continue;
		seen[r.source_key].add(sig);
		(out[r.source_key] ??= []).push(swap);
	}
	return out;
}

// ── Buildings (reference) ──────────────────────────────────────────────────────

export interface BuildingResourceRow {
	kind: 'cost' | 'upkeep' | 'produces';
	resource: string;
	amount: number;
}
export interface BuildingJobRow {
	job: string; // display name, e.g. "metallurgist"
	amount: number; // raw count (Stellaris 4.0 scales jobs ×100)
}
// A building effect other than jobs; `condition` = an ascension perk it needs (else null).
export interface ReferenceBuildingModifier extends Modifier {
	scope: 'planet' | 'country' | 'system' | 'station';
	condition: string | null;
}
export interface ReferenceBuilding {
	key: string;
	name: string | null;
	category: string | null;
	description: string | null;
	resources: BuildingResourceRow[];
	jobs: BuildingJobRow[];
	modifiers: ReferenceBuildingModifier[];
	unlockedBy: string[]; // the civics/origins it requires
}

export function loadBuildings(): ReferenceBuilding[] {
	const d = db();
	const rows = d
		.prepare('SELECT key, name, category, description FROM building ORDER BY sort_order')
		.all() as Array<{
		key: string;
		name: string | null;
		category: string | null;
		description: string | null;
	}>;
	const resRows = d
		.prepare(
			'SELECT building_key, kind, resource, amount FROM building_resource ORDER BY building_key, kind, sort_order'
		)
		.all() as Array<{ building_key: string; kind: string; resource: string; amount: number }>;
	const jobRows = d
		.prepare('SELECT building_key, job, amount FROM building_job ORDER BY building_key, sort_order')
		.all() as Array<{ building_key: string; job: string; amount: number }>;
	const resBy = new Map<string, BuildingResourceRow[]>();
	for (const r of resRows) {
		if (!resBy.has(r.building_key)) resBy.set(r.building_key, []);
		resBy.get(r.building_key)!.push({
			kind: r.kind as BuildingResourceRow['kind'],
			resource: r.resource,
			amount: r.amount
		});
	}
	const modRows = d
		.prepare(
			`SELECT bm.building_key, bm.scope, bm.modifier_key, bm.value, bm.condition,
			        ml.label, ml.positive_is_good
			 FROM building_modifier bm
			 LEFT JOIN modifier_label ml ON ml.modifier_key = bm.modifier_key
			 ORDER BY bm.building_key, bm.sort_order`
		)
		.all() as Array<{
		building_key: string;
		scope: ReferenceBuildingModifier['scope'];
		modifier_key: string;
		value: number;
		condition: string | null;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const modBy = new Map<string, ReferenceBuildingModifier[]>();
	for (const r of modRows)
		(modBy.get(r.building_key) ?? modBy.set(r.building_key, []).get(r.building_key)!).push({
			key: r.modifier_key,
			value: r.value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0,
			scope: r.scope,
			condition: r.condition
		});
	const unlockBy = new Map<string, string[]>();
	for (const r of d
		.prepare('SELECT owner_key, building_key FROM building_unlock ORDER BY owner_key')
		.all() as Array<{ owner_key: string; building_key: string }>)
		(unlockBy.get(r.building_key) ?? unlockBy.set(r.building_key, []).get(r.building_key)!).push(
			r.owner_key
		);
	const jobBy = new Map<string, BuildingJobRow[]>();
	for (const r of jobRows) {
		if (!jobBy.has(r.building_key)) jobBy.set(r.building_key, []);
		jobBy.get(r.building_key)!.push({ job: r.job, amount: r.amount });
	}
	return rows.map((r) => ({
		...r,
		resources: resBy.get(r.key) ?? [],
		jobs: jobBy.get(r.key) ?? [],
		modifiers: modBy.get(r.key) ?? [],
		unlockedBy: unlockBy.get(r.key) ?? []
	}));
}

// civic/origin key → the buildings it unlocks (for the Civics / Origins cards).
export function loadBuildingsByUnlock(): Record<string, ReferenceBuilding[]> {
	const out: Record<string, ReferenceBuilding[]> = {};
	for (const b of loadBuildings()) for (const owner of b.unlockedBy) (out[owner] ??= []).push(b);
	return out;
}
