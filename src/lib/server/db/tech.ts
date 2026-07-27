// Repeatable and fallen-empire technologies.
import { db } from './client';
import type { BuildingJobRow, BuildingResourceRow } from './jobs';
import type { Modifier } from './types';

export interface RepeatableTech {
	key: string;
	label: string | null;
	description: string | null;
	area: string;
	areaLabel: string | null;
	category: string | null;
	categoryLabel: string | null;
	levels: number | null; // -1 = unlimited
	modifiers: Modifier[];
}

export function loadRepeatableTechs(): RepeatableTech[] {
	const rows = db()
		.prepare(
			`SELECT key, label, description, area, area_label, category, category_label, levels
			 FROM tech_repeatable
			 ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		label: string | null;
		description: string | null;
		area: string;
		area_label: string | null;
		category: string | null;
		category_label: string | null;
		levels: number | null;
	}>;

	const modRows = db()
		.prepare(
			`SELECT m.tech_key, m.modifier_key, m.modifier_value, ml.label, ml.positive_is_good
			 FROM tech_repeatable_modifier m
			 LEFT JOIN modifier_label ml ON m.modifier_key = ml.modifier_key
			 ORDER BY m.tech_key, m.sort_order`
		)
		.all() as Array<{
		tech_key: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;

	const modByTech = new Map<string, Modifier[]>();
	for (const r of modRows) {
		if (!modByTech.has(r.tech_key)) modByTech.set(r.tech_key, []);
		modByTech.get(r.tech_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	return rows.map((r) => ({
		key: r.key,
		label: r.label,
		description: r.description,
		area: r.area,
		areaLabel: r.area_label,
		category: r.category,
		categoryLabel: r.category_label,
		levels: r.levels,
		modifiers: modByTech.get(r.key) ?? []
	}));
}

export interface FallenEmpireTech {
	key: string;
	label: string | null;
	description: string | null;
	area: string;
	areaLabel: string | null;
	category: string | null;
	categoryLabel: string | null;
	buildingKey: string | null;
	building: {
		name: string | null;
		description: string | null;
		resources: BuildingResourceRow[];
		jobs: BuildingJobRow[];
	} | null;
}

export function loadFallenEmpireTechs(): FallenEmpireTech[] {
	const rows = db()
		.prepare(
			`SELECT t.key, t.label, t.description, t.area, t.area_label, t.category, t.category_label,
			        t.building_key,
			        b.name AS b_name, b.description AS b_desc
			 FROM tech_fallen_empire t
			 LEFT JOIN building b ON b.key = t.building_key
			 ORDER BY t.sort_order`
		)
		.all() as Array<{
		key: string;
		label: string | null;
		description: string | null;
		area: string;
		area_label: string | null;
		category: string | null;
		category_label: string | null;
		building_key: string | null;
		b_name: string | null;
		b_desc: string | null;
	}>;

	const buildingKeys = rows.map((r) => r.building_key).filter(Boolean) as string[];
	const placeholders = buildingKeys.map(() => '?').join(',');

	const resRows =
		buildingKeys.length > 0
			? (db()
					.prepare(
						`SELECT building_key, kind, resource, amount FROM building_resource
						 WHERE building_key IN (${placeholders})
						 ORDER BY building_key, kind, sort_order`
					)
					.all(...buildingKeys) as Array<{
					building_key: string;
					kind: string;
					resource: string;
					amount: number;
				}>)
			: [];

	const jobRows =
		buildingKeys.length > 0
			? (db()
					.prepare(
						`SELECT building_key, job, amount FROM building_job
						 WHERE building_key IN (${placeholders})
						 ORDER BY building_key, sort_order`
					)
					.all(...buildingKeys) as Array<{ building_key: string; job: string; amount: number }>)
			: [];

	const resBy = new Map<string, BuildingResourceRow[]>();
	for (const r of resRows) {
		if (!resBy.has(r.building_key)) resBy.set(r.building_key, []);
		resBy.get(r.building_key)!.push({
			kind: r.kind as BuildingResourceRow['kind'],
			resource: r.resource,
			amount: r.amount
		});
	}
	const jobBy = new Map<string, BuildingJobRow[]>();
	for (const r of jobRows) {
		if (!jobBy.has(r.building_key)) jobBy.set(r.building_key, []);
		jobBy.get(r.building_key)!.push({ job: r.job, amount: r.amount });
	}

	return rows.map((r) => ({
		key: r.key,
		label: r.label,
		description: r.description,
		area: r.area,
		areaLabel: r.area_label,
		category: r.category,
		categoryLabel: r.category_label,
		buildingKey: r.building_key,
		building: r.building_key
			? {
					name: r.b_name,
					description: r.b_desc,
					resources: resBy.get(r.building_key) ?? [],
					jobs: jobBy.get(r.building_key) ?? []
				}
			: null
	}));
}
