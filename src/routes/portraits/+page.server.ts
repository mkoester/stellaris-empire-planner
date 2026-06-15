import { loadPortraits, loadTraitsForKeys } from '$lib/server/db';
import { formatModifierValue, formatScalingModifier, modifierLabel } from '$lib/civics';
import type { PageServerLoad } from './$types';

export interface TraitInfo {
	tooltip: string; // effect lines + flavour description, for a hover popup
	negative: boolean; // a drawback trait — shown in a distinct (rose) colour
}

export const load: PageServerLoad = () => {
	const portraits = loadPortraits();

	// Build a hover popup + polarity for every trait referenced (class-gated or bonus).
	const keys = [
		...new Set(
			portraits.flatMap((p) => [...p.classes.flatMap((c) => c.traitKeys), ...p.bonusTraitKeys])
		)
	];
	const traitInfo: Record<string, TraitInfo> = {};
	for (const t of loadTraitsForKeys(keys)) {
		const effects = [
			...t.modifiers.map((m) => `${formatModifierValue(m)} ${modifierLabel(m)}`),
			...t.scalingModifiers.map((s) => formatScalingModifier(s))
		];
		traitInfo[t.key] = {
			tooltip: [effects.join('\n'), t.description ?? ''].filter(Boolean).join('\n\n'),
			negative: t.tags.includes('negative') || (t.cost != null && t.cost < 0)
		};
	}

	return { portraits, traitInfo };
};
