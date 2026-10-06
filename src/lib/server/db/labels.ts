// Cross-entity display names, modifier label index, overview tooltips.
import { formatModifierValue, formatScalingModifier, modifierLabel } from '$lib/civics';
import { db } from './client';
import { loadAuthorities, loadCivics, loadEthics, loadOrigins } from './government';
import { loadTraitsForKeys, scalingModifiersByTrait } from './species';
import type { Modifier, ScalingModifier } from './types';

// Key → display name across the entity tables that have stored names, so an empire's
// raw keys (ethics/civics/origin/planet/species class) can be resolved for display.
export function loadEntityNames(): Record<string, string> {
	const d = db();
	const out: Record<string, string> = {};
	const sources: [string, string][] = [
		['SELECT key, label AS name FROM species_class WHERE label IS NOT NULL', 'species'],
		['SELECT key, label AS name FROM ethic WHERE label IS NOT NULL', 'ethic'],
		['SELECT key, name FROM civic WHERE name IS NOT NULL', 'civic'],
		['SELECT key, name FROM origin WHERE name IS NOT NULL', 'origin'],
		['SELECT key, name FROM authority WHERE name IS NOT NULL', 'authority'],
		['SELECT key, name FROM planet_class WHERE name IS NOT NULL', 'planet'],
		['SELECT key, name FROM initializer WHERE name IS NOT NULL', 'initializer']
	];
	for (const [sql] of sources) {
		for (const r of d.prepare(sql).all() as Array<{ key: string; name: string }>) {
			out[r.key] = r.name;
		}
	}
	return out;
}

// Per-key modifier index for the chosen-empire "Effects" summary: every ethic,
// civic, origin and trait that carries numeric modifiers, keyed by its raw key.
// `kind` says where the modifier comes from ("ethic"/"civic"/…); names are
// resolved separately (loadEntityNames + key formatting for traits).
export interface ModifierSource {
	kind: 'ethic' | 'authority' | 'civic' | 'origin' | 'trait';
	modifiers: Modifier[];
	scaling?: ScalingModifier[]; // count-scaled effects (Familial, Noxious, Genetic Memory)
}

export function loadModifierIndex(): Record<string, ModifierSource> {
	const out: Record<string, ModifierSource> = {};
	const add = (
		key: string,
		kind: ModifierSource['kind'],
		modifiers: Modifier[],
		scaling: ScalingModifier[] = []
	) => {
		if (modifiers.length || scaling.length) out[key] = { kind, modifiers, scaling };
	};
	for (const e of loadEthics()) add(e.key, 'ethic', e.modifiers);
	for (const a of loadAuthorities()) add(a.key, 'authority', a.modifiers);
	for (const c of loadCivics()) add(c.key, 'civic', c.modifiers);
	for (const o of loadOrigins()) add(o.key, 'origin', o.modifiers);
	// ALL trait modifiers (not just builder-visible traits): an empire can carry 0-cost /
	// null-category traits like the base trait_organic/_lithoid/_mechanical, whose modifiers
	// (e.g. −1 Food upkeep) must still be attributed in the Species traits effects.
	const traitMods = new Map<string, Modifier[]>();
	for (const r of db()
		.prepare(
			`SELECT tm.trait_key, tm.modifier_key, tm.modifier_value, ml.label, ml.positive_is_good
			 FROM trait_modifier tm
			 LEFT JOIN modifier_label ml ON ml.modifier_key = tm.modifier_key
			 ORDER BY tm.trait_key, tm.sort_order`
		)
		.all() as Array<{
		trait_key: string;
		modifier_key: string;
		modifier_value: number;
		label: string | null;
		positive_is_good: number | null;
	}>) {
		if (!traitMods.has(r.trait_key)) traitMods.set(r.trait_key, []);
		traitMods.get(r.trait_key)!.push({
			key: r.modifier_key,
			value: r.modifier_value,
			label: r.label,
			positiveIsGood: r.positive_is_good !== 0
		});
	}
	// Count-scaled trait effects (Familial/Noxious/Genetic Memory) — some traits carry ONLY
	// these (no flat modifier), so union the keys so those traits still get a source entry.
	const traitScaling = scalingModifiersByTrait();
	for (const key of new Set([...traitMods.keys(), ...traitScaling.keys()])) {
		add(key, 'trait', traitMods.get(key) ?? [], traitScaling.get(key) ?? []);
	}
	return out;
}

// key → a short hover-tooltip string for the floating empire overview: each item's
// effects (modifiers/scaling) followed by its flavour description, so items that lack a
// description (e.g. Mining Guilds, Meritocracy) still show their effects.
export function loadOverviewTooltips(): Record<string, string> {
	const out: Record<string, string> = {};
	const fx = (mods: Modifier[]) => mods.map((m) => `${formatModifierValue(m)} ${modifierLabel(m)}`);
	const set = (key: string, effects: string[], description?: string | null) => {
		const text = [effects.join('\n'), description ?? ''].filter(Boolean).join('\n\n');
		if (text) out[key] = text;
	};
	for (const e of loadEthics()) set(e.key, fx(e.modifiers));
	for (const a of loadAuthorities()) set(a.key, fx(a.modifiers), a.description);
	for (const c of loadCivics()) set(c.key, fx(c.modifiers), c.description);
	for (const o of loadOrigins()) set(o.key, fx(o.modifiers), o.description);
	// All traits (loadTraits drops 0-cost/null-category base traits like trait_lithoid, which
	// the overview still shows) — load every key so the base trait gets a tooltip too.
	const traitKeys = (db().prepare('SELECT key FROM trait').all() as { key: string }[]).map(
		(r) => r.key
	);
	for (const t of loadTraitsForKeys(traitKeys)) {
		const effects = [...fx(t.modifiers), ...t.scalingModifiers.map(formatScalingModifier)];
		const text = [effects.join('\n'), t.effect, t.description].filter(Boolean).join('\n\n');
		if (text) out[t.key] = text;
	}
	return out;
}

// ── Precursors ─────────────────────────────────────────────────────────────
