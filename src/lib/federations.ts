// Pure helpers for federation types: the hover summary shown wherever one is linked, and
// which types a civic or ethic opens up or rules out.
import type { FederationPerk, FederationType, PerkScope } from '$lib/server/db';
import { formatModifierValue, modifierLabel } from '$lib/civics';

export const SCOPE_LABELS: Record<PerkScope, string> = {
	members: 'Members',
	federation: 'Federation',
	leader: 'President',
	envoy: 'Envoys'
};

// A perk's effect as text lines: "Members: +25% Naval Capacity", then the effect text.
export function perkLines(perk: FederationPerk): string[] {
	return [
		...perk.modifiers.map(
			(m) => `${SCOPE_LABELS[m.scope]}: ${formatModifierValue(m)} ${modifierLabel(m)}`
		),
		...(perk.effect ? [perk.effect] : [])
	];
}

export function federationTip(t: FederationType): string {
	const passive = t.levels[0]?.perks.flatMap(perkLines) ?? [];
	const lines = [`Federation type: ${t.name ?? t.key}`];
	if (passive.length) lines.push('From the start:', ...passive.map((l) => `  ${l}`));
	if (t.description) lines.push('', t.description);
	return lines.join('\n');
}

// The federation types a key (civic, ethic, tradition) grants access to, and those it rules out.
export function federationsFor(
	key: string,
	types: FederationType[]
): { forms: FederationType[]; blocks: FederationType[] } {
	return {
		forms: types.filter((t) => t.unlockedBy.includes(key)),
		blocks: types.filter((t) => t.excludedBy.includes(key))
	};
}

// Everything searchable about a federation type: its name, description and every perk.
export function federationSearchText(t: FederationType): string {
	const parts = [t.name, t.description];
	for (const l of t.levels)
		for (const p of l.perks) parts.push(p.name, p.description, ...perkLines(p));
	return parts.filter(Boolean).join('\n').toLowerCase();
}
