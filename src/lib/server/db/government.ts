// Ethics, civics, authorities, origins.
import { db } from './client';
import type { Empire } from './empires';
import type { Modifier } from './types';

export interface EthicImplication {
	tag: string;
	label: string;
}

export interface PolicyRestriction {
	policyKey: string;
	optionKey: string;
	optionLabel: string | null;
}

export interface Ethic {
	key: string;
	label: string | null;
	cost: number;
	gestalt: boolean;
	fanatic_variant: string | null;
	regular_variant: string | null;
	modifiers: Modifier[];
	implications: EthicImplication[];
	policyRestrictions: PolicyRestriction[];
}

export function loadEthics(): Ethic[] {
	const rows = db()
		.prepare(
			`SELECT key, label, cost, gestalt, fanatic_variant, regular_variant
			 FROM ethic
			 WHERE cost >= 1
			 ORDER BY gestalt ASC, cost DESC, key ASC`
		)
		.all() as Array<{
		key: string;
		label: string | null;
		cost: number;
		gestalt: number;
		fanatic_variant: string | null;
		regular_variant: string | null;
	}>;

	const modRows = db()
		.prepare(
			`SELECT em.ethic_key, em.modifier_key, em.modifier_value, ml.label, ml.positive_is_good
			 FROM ethic_modifier em
			 LEFT JOIN modifier_label ml ON em.modifier_key = ml.modifier_key
			 ORDER BY em.ethic_key, em.sort_order`
		)
		.all() as Array<{
		ethic_key: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;

	const modByEthic = new Map<string, Modifier[]>();
	for (const r of modRows) {
		if (!modByEthic.has(r.ethic_key)) modByEthic.set(r.ethic_key, []);
		modByEthic.get(r.ethic_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	const tagRows = db()
		.prepare(
			`SELECT et.ethic_key, et.tag, etl.label
			 FROM ethic_tag et
			 LEFT JOIN ethic_tag_label etl ON et.tag = etl.tag
			 ORDER BY et.ethic_key, et.sort_order`
		)
		.all() as Array<{ ethic_key: string; tag: string; label: string | null }>;

	const tagsByEthic = new Map<string, EthicImplication[]>();
	for (const r of tagRows) {
		if (!r.label) continue; // skip tags without a readable label
		if (!tagsByEthic.has(r.ethic_key)) tagsByEthic.set(r.ethic_key, []);
		tagsByEthic.get(r.ethic_key)!.push({ tag: r.tag, label: r.label });
	}

	const prRows = db()
		.prepare(
			`SELECT ethic_key, policy_key, option_key, option_label
			 FROM ethic_policy_restriction
			 ORDER BY ethic_key, policy_key, option_key`
		)
		.all() as Array<{
		ethic_key: string;
		policy_key: string;
		option_key: string;
		option_label: string | null;
	}>;

	const prByEthic = new Map<string, PolicyRestriction[]>();
	for (const r of prRows) {
		if (!prByEthic.has(r.ethic_key)) prByEthic.set(r.ethic_key, []);
		prByEthic.get(r.ethic_key)!.push({
			policyKey: r.policy_key,
			optionKey: r.option_key,
			optionLabel: r.option_label
		});
	}

	return rows.map((r) => ({
		key: r.key,
		label: r.label,
		cost: r.cost,
		gestalt: r.gestalt === 1,
		fanatic_variant: r.fanatic_variant,
		regular_variant: r.regular_variant,
		modifiers: modByEthic.get(r.key) ?? [],
		implications: tagsByEthic.get(r.key) ?? [],
		policyRestrictions: prByEthic.get(r.key) ?? []
	}));
}

// ── Civics ───────────────────────────────────────────────────────────────────

// One eligibility rule parsed from a civic's potential/possible blocks. `kind` is
// what is constrained (authority/ethic/civic/origin); `operator` is 'require',
// 'forbid', or 'require_any' (one of an OR set, tied together by `groupId`).
export interface CivicRequirement {
	kind: string;
	operator: string;
	value: string;
	groupId: number;
}

export interface Civic {
	key: string;
	name: string | null;
	description: string | null;
	civicType: string; // 'normal' | 'gestalt' | 'corporate' | 'special'
	requiredDlc: string | null;
	locked: boolean; // `modification = no`: can't be added/removed after game start
	icon: string | null;
	modifiers: Modifier[];
	requirements: CivicRequirement[];
}

// Player-selectable civics (skips non-pickable ones gated to fallen empires etc.),
// with their numeric modifiers and parsed eligibility rules.
export function loadCivics(): Civic[] {
	const d = db();
	const rows = d
		.prepare(
			`SELECT key, name, description, civic_type, required_dlc, locked, icon
			 FROM civic WHERE selectable = 1 ORDER BY civic_type, sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		civic_type: string;
		required_dlc: string | null;
		locked: number;
		icon: string | null;
	}>;

	const modRows = d
		.prepare(
			`SELECT cm.civic_key, cm.modifier_key, cm.modifier_value, ml.label, ml.positive_is_good
			 FROM civic_modifier cm
			 LEFT JOIN modifier_label ml ON ml.modifier_key = cm.modifier_key
			 ORDER BY cm.civic_key, cm.sort_order`
		)
		.all() as Array<{
		civic_key: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const modByCivic = new Map<string, Modifier[]>();
	for (const r of modRows) {
		if (!modByCivic.has(r.civic_key)) modByCivic.set(r.civic_key, []);
		modByCivic.get(r.civic_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	const reqRows = d
		.prepare(
			`SELECT civic_key, kind, operator, value, group_id
			 FROM civic_requirement ORDER BY civic_key, kind, operator`
		)
		.all() as Array<{
		civic_key: string;
		kind: string;
		operator: string;
		value: string;
		group_id: number;
	}>;
	const reqByCivic = new Map<string, CivicRequirement[]>();
	for (const r of reqRows) {
		if (!reqByCivic.has(r.civic_key)) reqByCivic.set(r.civic_key, []);
		reqByCivic.get(r.civic_key)!.push({
			kind: r.kind,
			operator: r.operator,
			value: r.value,
			groupId: r.group_id
		});
	}

	return rows.map((r) => ({
		key: r.key,
		name: r.name,
		description: r.description,
		civicType: r.civic_type,
		requiredDlc: r.required_dlc,
		locked: r.locked === 1,
		icon: r.icon,
		modifiers: modByCivic.get(r.key) ?? [],
		requirements: reqByCivic.get(r.key) ?? []
	}));
}

// The civic keys that can't be added/removed after game start (`modification = no`),
// for marking them with a lock wherever civics are listed (Empire summary, overview).
export function loadLockedCivicKeys(): string[] {
	return (db().prepare('SELECT key FROM civic WHERE locked = 1').all() as { key: string }[]).map(
		(r) => r.key
	);
}

// ── Authorities (government types) ─────────────────────────────────────────────

// The empire's government type (Democratic, Imperial, Hive Mind, …). Same modifier +
// requirement shape as civics; requirements gate on ethics and species archetype.
export interface Authority {
	key: string;
	name: string | null;
	description: string | null;
	requiredDlc: string | null;
	icon: string | null;
	modifiers: Modifier[];
	requirements: CivicRequirement[];
}

// Player-selectable government authorities (skips ones gated to a non-player country
// type, e.g. the Ancient Machine Intelligence).
export function loadAuthorities(): Authority[] {
	const d = db();
	const rows = d
		.prepare(
			`SELECT key, name, description, required_dlc, icon
			 FROM authority WHERE selectable = 1 ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		required_dlc: string | null;
		icon: string | null;
	}>;

	const modRows = d
		.prepare(
			`SELECT am.authority_key, am.modifier_key, am.modifier_value, ml.label, ml.positive_is_good
			 FROM authority_modifier am
			 LEFT JOIN modifier_label ml ON ml.modifier_key = am.modifier_key
			 ORDER BY am.authority_key, am.sort_order`
		)
		.all() as Array<{
		authority_key: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const modByAuth = new Map<string, Modifier[]>();
	for (const r of modRows) {
		if (!modByAuth.has(r.authority_key)) modByAuth.set(r.authority_key, []);
		modByAuth.get(r.authority_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	const reqRows = d
		.prepare(
			`SELECT authority_key, kind, operator, value, group_id
			 FROM authority_requirement ORDER BY authority_key, kind, operator`
		)
		.all() as Array<{
		authority_key: string;
		kind: string;
		operator: string;
		value: string;
		group_id: number;
	}>;
	const reqByAuth = new Map<string, CivicRequirement[]>();
	for (const r of reqRows) {
		if (!reqByAuth.has(r.authority_key)) reqByAuth.set(r.authority_key, []);
		reqByAuth.get(r.authority_key)!.push({
			kind: r.kind,
			operator: r.operator,
			value: r.value,
			groupId: r.group_id
		});
	}

	return rows.map((r) => ({
		key: r.key,
		name: r.name,
		description: r.description,
		requiredDlc: r.required_dlc,
		icon: r.icon,
		modifiers: modByAuth.get(r.key) ?? [],
		requirements: reqByAuth.get(r.key) ?? []
	}));
}

// ── Origins ──────────────────────────────────────────────────────────────────

// The empire's starting scenario. Same requirement shape as civics (reuses
// CivicRequirement); most origins' real effects are narrative — `description` is the
// main payload, with `modifiers[]` where the origin has numeric effects.
export interface Origin {
	key: string;
	name: string | null;
	description: string | null;
	requiredDlc: string | null;
	ascensionLock: string | null; // locked to this single ascension path (blocks the others)
	ascensionBlocks: string[]; // ascension paths blocked while still allowing others
	startingColony: string | null; // forced starting world class (e.g. pc_gaia); null = normal
	forcesHomeSystem: boolean; // origin forces a fixed home system (a non custom-empire start)
	icon: string | null;
	modifiers: Modifier[];
	requirements: CivicRequirement[];
}

export function loadOrigins(): Origin[] {
	const d = db();
	const rows = d
		.prepare(
			`SELECT key, name, description, required_dlc, ascension_lock, ascension_blocks,
			        starting_colony, forces_home_system, icon
			 FROM origin WHERE selectable = 1 ORDER BY sort_order`
		)
		.all() as Array<{
		key: string;
		name: string | null;
		description: string | null;
		required_dlc: string | null;
		ascension_lock: string | null;
		ascension_blocks: string | null;
		starting_colony: string | null;
		forces_home_system: number;
		icon: string | null;
	}>;

	const modRows = d
		.prepare(
			`SELECT om.origin_key, om.modifier_key, om.modifier_value, ml.label, ml.positive_is_good
			 FROM origin_modifier om
			 LEFT JOIN modifier_label ml ON ml.modifier_key = om.modifier_key
			 ORDER BY om.origin_key, om.sort_order`
		)
		.all() as Array<{
		origin_key: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>;
	const modByOrigin = new Map<string, Modifier[]>();
	for (const r of modRows) {
		if (!modByOrigin.has(r.origin_key)) modByOrigin.set(r.origin_key, []);
		modByOrigin.get(r.origin_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}

	const reqRows = d
		.prepare(
			`SELECT origin_key, kind, operator, value, group_id
			 FROM origin_requirement ORDER BY origin_key, kind, operator`
		)
		.all() as Array<{
		origin_key: string;
		kind: string;
		operator: string;
		value: string;
		group_id: number;
	}>;
	const reqByOrigin = new Map<string, CivicRequirement[]>();
	for (const r of reqRows) {
		if (!reqByOrigin.has(r.origin_key)) reqByOrigin.set(r.origin_key, []);
		reqByOrigin.get(r.origin_key)!.push({
			kind: r.kind,
			operator: r.operator,
			value: r.value,
			groupId: r.group_id
		});
	}

	return rows.map((r) => ({
		key: r.key,
		name: r.name,
		description: r.description,
		requiredDlc: r.required_dlc,
		ascensionLock: r.ascension_lock,
		ascensionBlocks: r.ascension_blocks ? r.ascension_blocks.split(',') : [],
		startingColony: r.starting_colony,
		forcesHomeSystem: r.forces_home_system === 1,
		icon: r.icon,
		modifiers: modByOrigin.get(r.key) ?? [],
		requirements: reqByOrigin.get(r.key) ?? []
	}));
}

// How an origin overrides the start (for the empire overviews): its forced starting
// world (pc key) and/or whether it forces a fixed home system. Only origins that
// override anything are included.
export interface OriginStart {
	world: string | null;
	forcesSystem: boolean;
}
export function loadOriginStarts(): Record<string, OriginStart> {
	const out: Record<string, OriginStart> = {};
	for (const r of db()
		.prepare(
			`SELECT key, starting_colony, forces_home_system FROM origin
			 WHERE starting_colony IS NOT NULL OR forces_home_system = 1`
		)
		.all() as Array<{ key: string; starting_colony: string | null; forces_home_system: number }>) {
		out[r.key] = { world: r.starting_colony, forcesSystem: r.forces_home_system === 1 };
	}
	return out;
}

// ── Planet classes ───────────────────────────────────────────────────────────
