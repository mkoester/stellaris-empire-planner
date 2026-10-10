// Cross-section compatibility: checks the empire's picks (ethics, civics, origin,
// government, species class, traits, homeworld, ship type) against every civic / origin /
// authority / trait eligibility rule, plus the traits civics and origins grant (Tankbound
// gives trait_tankbound, which rules out Weak). Warn-only: the builder pages mark
// conflicting options with the reasons, and the Empire page lists what the draft breaks.
//
// A gate on something not chosen yet never fires — an unset species class can't violate
// "needs an Infernal species" — so planning in any order doesn't drown in warnings.
import type { CompatData, CompatRule } from '$lib/server/db';
import type { EmpireDraft } from '$lib/empire.svelte';
import { keyName } from '$lib/empireFile';

export interface Picks {
	ethics: string[];
	civics: string[];
	origin: string | null;
	authority: string | null;
	speciesClass: string | null;
	baseTrait: string | null; // the class's auto-included trait (Organic, Lithoid, …)
	traits: string[]; // founder traits picked in the builder
	secondaryTraits: string[];
	homeworld: string | null; // effective: the origin's forced world, else the picked class
	shipType: 'organic' | 'regular' | null;
}

// What a builder page offers: one candidate pick, checked against the rest of the draft.
export type PickKind =
	'ethic' | 'civic' | 'origin' | 'authority' | 'species_class' | 'trait' | 'planet_class';
export interface PickRef {
	kind: PickKind;
	key: string;
}

export interface Conflict {
	id: string; // stable identity, for diffing before/after a pick
	text: string; // e.g. "Necrophage (origin) rules out Xenophile"
}

export type NameFn = (key: string) => string;

export function picksFromDraft(
	d: EmpireDraft,
	baseTraitByClass: Record<string, string>,
	originStarts: Record<string, { world: string | null }>
): Picks {
	const forced = d.origin ? (originStarts[d.origin]?.world ?? null) : null;
	return {
		ethics: d.ethics,
		civics: d.civics,
		origin: d.origin,
		authority: d.authority,
		speciesClass: d.speciesClass,
		baseTrait: d.speciesClass ? (baseTraitByClass[d.speciesClass] ?? null) : null,
		traits: d.traits,
		secondaryTraits: d.secondary?.traits ?? [],
		homeworld: forced ?? d.planetClass,
		shipType: !d.graphicalCulture
			? null
			: d.graphicalCulture.startsWith('biogenesis')
				? 'organic'
				: 'regular'
	};
}

// The traits the picked civics/origin give the founder species, with who grants each.
export function grantedTraits(p: Picks, data: CompatData): { trait: string; source: string }[] {
	const out: { trait: string; source: string }[] = [];
	for (const src of [...(p.origin ? [p.origin] : []), ...p.civics])
		for (const trait of data.grantedTraits[src] ?? [])
			if (!out.some((g) => g.trait === trait)) out.push({ trait, source: src });
	return out;
}

const founderTraits = (p: Picks, data: CompatData): string[] => [
	...new Set([
		...(p.baseTrait ? [p.baseTrait] : []),
		...p.traits,
		...grantedTraits(p, data).map((g) => g.trait)
	])
];

// The chosen values per gated kind; null = not chosen yet (its gates don't fire).
function facts(p: Picks, data: CompatData): Record<string, string[] | null> {
	const nonEmpty = (xs: string[]) => (xs.length ? xs : null);
	const one = (x: string | null) => (x ? [x] : null);
	const archetype = p.speciesClass ? (data.archetypeByClass[p.speciesClass] ?? null) : null;
	// Nomadic play is decided by the origin: it either requires or forbids it (or allows both).
	const nomadRule = p.origin
		? rulesByOwner(data)
				.get(`origin:${p.origin}`)
				?.find((r) => r.kind === 'gameplay')
		: undefined;
	return {
		ethic: nonEmpty(p.ethics),
		civic: nonEmpty(p.civics),
		origin: one(p.origin),
		authority: one(p.authority),
		species_class: one(p.speciesClass),
		archetype: one(archetype),
		planet_class: one(p.homeworld),
		trait: nonEmpty(founderTraits(p, data)),
		ship_type: one(p.shipType),
		gameplay: nomadRule ? (nomadRule.operator === 'forbid' ? [] : ['nomadic']) : null
	};
}

const indexCache = new WeakMap<CompatData, Map<string, CompatRule[]>>();
function rulesByOwner(data: CompatData): Map<string, CompatRule[]> {
	let idx = indexCache.get(data);
	if (!idx) {
		idx = new Map();
		for (const r of data.rules) {
			const k = `${r.ownerKind}:${r.owner}`;
			(idx.get(k) ?? idx.set(k, []).get(k)!).push(r);
		}
		indexCache.set(data, idx);
	}
	return idx;
}

// Display text for a gated value of a given kind.
export function valueLabel(kind: string, value: string, name: NameFn): string {
	if (kind === 'archetype') return value.charAt(0) + value.slice(1).toLowerCase();
	if (kind === 'ship_type') return `${name(value)} ships`;
	if (kind === 'gameplay') return `${name(value)} gameplay`;
	if (kind === 'planet_class') return `${name(value)} homeworld`;
	if (kind === 'species_class') return `${name(value)} species`;
	return name(value);
}

// Every rule the picks break.
export function violations(p: Picks, data: CompatData, name: NameFn): Conflict[] {
	const f = facts(p, data);
	const idx = rulesByOwner(data);
	const owners: [string, string][] = [
		...p.civics.map((k): [string, string] => ['civic', k]),
		...(p.origin ? [['origin', p.origin] as [string, string]] : []),
		...(p.authority ? [['authority', p.authority] as [string, string]] : []),
		...[...new Set([...founderTraits(p, data), ...p.secondaryTraits])].map(
			(k): [string, string] => ['trait', k]
		)
	];
	const out: Conflict[] = [];
	for (const [ownerKind, owner] of owners) {
		const rules = idx.get(`${ownerKind}:${owner}`) ?? [];
		const src = `${name(owner)} (${ownerKind})`;
		const anyGroups = new Map<number, CompatRule[]>();
		for (const r of rules) {
			const have = f[r.kind];
			if (!have) continue; // not chosen yet
			if (r.operator === 'require_any') {
				(anyGroups.get(r.groupId) ?? anyGroups.set(r.groupId, []).get(r.groupId)!).push(r);
			} else if (r.operator === 'require' && !have.includes(r.value)) {
				out.push({
					id: `${owner}|${r.kind}|require|${r.value}`,
					text: `${src} needs ${valueLabel(r.kind, r.value, name)}`
				});
			} else if (r.operator === 'forbid' && have.includes(r.value)) {
				out.push({
					id: `${owner}|${r.kind}|forbid|${r.value}`,
					text: `${src} rules out ${valueLabel(r.kind, r.value, name)}`
				});
			}
		}
		for (const [gid, group] of anyGroups) {
			const kind = group[0].kind;
			if (group.some((r) => f[kind]!.includes(r.value))) continue;
			const opts = group.map((r) => valueLabel(kind, r.value, name));
			out.push({
				id: `${owner}|${kind}|any|${gid}`,
				text: `${src} needs ${opts.length > 1 ? 'one of ' : ''}${opts.join(', ')}`
			});
		}
	}
	// A granted trait's opposites (Tankbound ↔ Weak / Hollow Bones / Photoadaptive).
	const mine = founderTraits(p, data);
	const opp = (a: string, b: string) =>
		(data.opposites[a] ?? []).includes(b) || (data.opposites[b] ?? []).includes(a);
	for (const g of grantedTraits(p, data))
		for (const t of mine)
			if (t !== g.trait && opp(g.trait, t))
				out.push({
					id: `${g.source}|opposite|${g.trait}|${t}`,
					text: `${name(g.source)} gives the ${name(g.trait)} trait, which rules out ${name(t)}`
				});
	return out;
}

function setPick(p: Picks, ref: PickRef, on: boolean): Picks {
	const toggle = (xs: string[]) =>
		on ? (xs.includes(ref.key) ? xs : [...xs, ref.key]) : xs.filter((x) => x !== ref.key);
	const one = on ? ref.key : null;
	switch (ref.kind) {
		case 'ethic':
			return { ...p, ethics: toggle(p.ethics) };
		case 'civic':
			return { ...p, civics: toggle(p.civics) };
		case 'trait':
			return { ...p, traits: toggle(p.traits) };
		case 'origin':
			return { ...p, origin: one };
		case 'authority':
			return { ...p, authority: one };
		case 'species_class':
			return { ...p, speciesClass: one };
		case 'planet_class':
			return { ...p, homeworld: one };
	}
}

// Why picking `ref` clashes with the rest of the draft (empty = fine). Works for options
// already picked too: compares the draft without the pick against the draft with it, so
// both directions count — Xenophile is flagged while Necrophage is picked, and vice versa.
export function conflictsFor(p: Picks, ref: PickRef, data: CompatData, name: NameFn): Conflict[] {
	const before = new Set(violations(setPick(p, ref, false), data, name).map((c) => c.id));
	return violations(setPick(p, ref, true), data, name).filter((c) => !before.has(c.id));
}

// The builder pages' entry point: a checker bound to the current draft and the layout's
// shared data, returning the reasons a candidate pick clashes (empty = fine).
export interface CompatContext {
	compat: CompatData;
	names: Record<string, string>;
	baseTraitByClass: Record<string, string>;
	originStarts: Record<string, { world: string | null }>;
}
export function compatChecker(d: EmpireDraft, ctx: CompatContext) {
	const p = picksFromDraft(d, ctx.baseTraitByClass, ctx.originStarts);
	const name = (k: string) => keyName(k, ctx.names);
	return {
		picks: p,
		name,
		reasons: (kind: PickKind, key: string): string[] =>
			conflictsFor(p, { kind, key }, ctx.compat, name).map((c) => c.text),
		all: (): string[] => violations(p, ctx.compat, name).map((c) => c.text)
	};
}
