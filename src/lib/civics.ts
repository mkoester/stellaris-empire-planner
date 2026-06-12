// Presentation-layer helpers for the /civics route. Pure data → display logic so
// they can be unit-tested; types come in type-only.
import type { Civic, CivicRequirement, Modifier } from '$lib/server/db';

export function civicTypeLabel(t: string): string {
	return (
		{ normal: 'Regular', gestalt: 'Gestalt', corporate: 'Corporate', special: 'Special' }[t] ?? t
	);
}

// Group selectable civics by their type, in a stable display order.
const TYPE_ORDER = ['normal', 'gestalt', 'corporate', 'special'];
export function groupCivicsByType(
	civics: Civic[]
): { type: string; label: string; items: Civic[] }[] {
	const by = new Map<string, Civic[]>();
	for (const c of civics) {
		if (!by.has(c.civicType)) by.set(c.civicType, []);
		by.get(c.civicType)!.push(c);
	}
	return TYPE_ORDER.filter((t) => by.has(t)).map((t) => ({
		type: t,
		label: civicTypeLabel(t),
		items: by.get(t)!
	}));
}

// Turn a gating key (ethic_/auth_/civic_/origin_) into a readable name, e.g.
// "ethic_fanatic_materialist" → "Fanatic Materialist", "auth_corporate" → "Corporate".
// Only the leading category prefix is stripped — the corporate/machine/hive part of
// a civic key is kept so distinct civics don't collapse to the same name (e.g.
// civic_anglers → "Anglers", civic_corporate_anglers → "Corporate Anglers").
const PREFIXES = ['ethic_fanatic_', 'ethic_', 'auth_', 'civic_', 'origin_'];
export function prettyKey(value: string): string {
	let s = value;
	for (const p of PREFIXES) {
		if (s.startsWith(p)) {
			s = s.slice(p.length);
			break;
		}
	}
	s = s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	if (value.startsWith('ethic_fanatic_')) s = `Fanatic ${s}`;
	return s;
}

// Modifiers stored as a fraction but shown as a percentage. `_mult` (including
// variants like `_mult_uninhabitable`) and `_perc` keys are always percentages; a
// number of `_add`/suffixless families (happiness, habitability, attraction,
// tolerance, exp gain, research/survey speed, chances, and a few combat stats) are
// too — whereas flat amounts (envoys, leader skill, per-job resource output,
// influence, loyalty, trait counts) stay raw. This is the ONE place modifier values
// are turned into percentages; every page formats through formatModifierValue.
function isPercentModifier(key: string): boolean {
	if (key.includes('_mult') || key.endsWith('_perc')) return true;
	return /habitability|happiness|attraction|tolerance|_exp_gain$|research_speed$|survey_speed|_chance_add$|army_health$|weapon_damage$|orbital_bombardment_damage$/.test(
		key
	);
}

// Format a modifier value: percentage families show `value × 100`%, everything else
// shows the raw number. Used by the civics/origins pages and the empire Effects block.
export function formatModifierValue(mod: Modifier): string {
	const sign = mod.value > 0 ? '+' : '';
	if (isPercentModifier(mod.key)) {
		const pct = mod.value * 100;
		const n = Number.isInteger(pct) ? pct : parseFloat(pct.toFixed(2));
		return `${sign}${n}%`;
	}
	const n = Number.isInteger(mod.value) ? mod.value : parseFloat(mod.value.toFixed(2));
	return `${sign}${n}`;
}

export function modifierColor(mod: Modifier): string {
	const good = mod.value > 0 === mod.positiveIsGood;
	return good ? 'text-emerald-400' : 'text-red-400';
}

// Collapse a civic's requirements into 'requires' / 'excludes' display lines. An
// OR set (require_any, same groupId) becomes a single "A or B" requires line.
export interface CivicRequirementLine {
	type: 'require' | 'exclude';
	text: string;
}
export function civicRequirementLines(reqs: CivicRequirement[]): CivicRequirementLine[] {
	const lines: CivicRequirementLine[] = [];
	const anyGroups = new Map<number, string[]>();
	for (const r of reqs) {
		if (r.operator === 'require_any') {
			if (!anyGroups.has(r.groupId)) anyGroups.set(r.groupId, []);
			anyGroups
				.get(r.groupId)!
				.push(r.kind === 'ship_type' ? `${prettyKey(r.value)} ships` : prettyKey(r.value));
		}
	}
	for (const vals of anyGroups.values()) lines.push({ type: 'require', text: vals.join(' or ') });
	for (const r of reqs) {
		// Ship-type gates read as "Organic ships" rather than just "Organic".
		const text = r.kind === 'ship_type' ? `${prettyKey(r.value)} ships` : prettyKey(r.value);
		if (r.operator === 'require') lines.push({ type: 'require', text });
		else if (r.operator === 'forbid') lines.push({ type: 'exclude', text });
	}
	// Drop duplicates (distinct keys can still map to the same display text).
	const seen = new Set<string>();
	return lines.filter((l) => {
		const id = `${l.type}|${l.text}`;
		if (seen.has(id)) return false;
		seen.add(id);
		return true;
	});
}
