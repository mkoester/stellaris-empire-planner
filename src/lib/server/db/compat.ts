// Cross-section compatibility rules: every civic / origin / authority / species-trait
// eligibility row in one flat list, plus the traits civics and origins grant, the trait
// opposites and the ascension-path gates. Evaluated against the draft by $lib/compat.
import { db } from './client';

export type RuleOwnerKind = 'civic' | 'origin' | 'authority' | 'trait';

export interface CompatRule {
	ownerKind: RuleOwnerKind;
	owner: string;
	kind: string; // what's gated: ethic / civic / origin / authority / species_class / archetype / planet_class / trait / ship_type / gameplay
	operator: 'require' | 'forbid' | 'require_any';
	value: string;
	groupId: number;
}

export interface CompatData {
	rules: CompatRule[];
	grantedTraits: Record<string, string[]>; // civic/origin key → traits it gives the founder species
	opposites: Record<string, string[]>; // trait key → mutually exclusive traits (as declared)
	archetypeByClass: Record<string, string>; // species class → BIOLOGICAL / LITHOID / MACHINE …
	ascension: Record<string, AscensionRestriction>; // civic/origin key → its ascension-path gate
}

// An origin's or civic's ascension-path gate: locked to one path, or some (all four for
// Natural Design) blocked.
export interface AscensionRestriction {
	lock: string | null;
	blocks: string[];
}

const RULE_SOURCES: [RuleOwnerKind, string, string][] = [
	['civic', 'civic_requirement', 'civic_key'],
	['origin', 'origin_requirement', 'origin_key'],
	['authority', 'authority_requirement', 'authority_key'],
	['trait', 'trait_requirement', 'trait_key']
];

export function loadCompatData(): CompatData {
	const d = db();
	const rules: CompatRule[] = [];
	for (const [ownerKind, table, col] of RULE_SOURCES) {
		for (const r of d
			.prepare(`SELECT ${col} AS owner, kind, operator, value, group_id FROM ${table}`)
			.all() as Array<{
			owner: string;
			kind: string;
			operator: CompatRule['operator'];
			value: string;
			group_id: number;
		}>) {
			rules.push({
				ownerKind,
				owner: r.owner,
				kind: r.kind,
				operator: r.operator,
				value: r.value,
				groupId: r.group_id
			});
		}
	}
	const grantedTraits: Record<string, string[]> = {};
	for (const r of d
		.prepare('SELECT owner_key, trait_key FROM granted_trait ORDER BY owner_key, trait_key')
		.all() as Array<{ owner_key: string; trait_key: string }>) {
		(grantedTraits[r.owner_key] ??= []).push(r.trait_key);
	}
	const opposites: Record<string, string[]> = {};
	for (const r of d.prepare('SELECT trait_key, opposite_key FROM trait_opposite').all() as Array<{
		trait_key: string;
		opposite_key: string;
	}>) {
		(opposites[r.trait_key] ??= []).push(r.opposite_key);
	}
	const archetypeByClass: Record<string, string> = {};
	for (const r of d
		.prepare('SELECT key, archetype FROM species_class WHERE archetype IS NOT NULL')
		.all() as Array<{ key: string; archetype: string }>) {
		archetypeByClass[r.key] = r.archetype;
	}
	const ascension: Record<string, AscensionRestriction> = {};
	for (const table of ['origin', 'civic'])
		for (const r of d
			.prepare(
				`SELECT key, ascension_lock, ascension_blocks FROM ${table}
				 WHERE ascension_lock IS NOT NULL OR ascension_blocks IS NOT NULL`
			)
			.all() as Array<{
			key: string;
			ascension_lock: string | null;
			ascension_blocks: string | null;
		}>)
			ascension[r.key] = {
				lock: r.ascension_lock,
				blocks: r.ascension_blocks ? r.ascension_blocks.split(',') : []
			};
	return { rules, grantedTraits, opposites, archetypeByClass, ascension };
}
