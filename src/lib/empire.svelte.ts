// The single "current empire" the whole app works on. The builder pages (Ethics,
// Species Builder, …) bind to this shared draft; importing a predefined empire or
// loading a user_empire_designs.txt applies into it (whole or partial — see apply()).
import type { Empire } from '$lib/server/db';

export interface EmpireDraft {
	name: string;
	speciesClass: string | null;
	speciesPortrait: string | null;
	traits: string[];
	ethics: string[];
	civics: string[];
	origin: string | null;
	planetClass: string | null;
	graphicalCulture: string | null;
}

const empty = (): EmpireDraft => ({
	name: '',
	speciesClass: null,
	speciesPortrait: null,
	traits: [],
	ethics: [],
	civics: [],
	origin: null,
	planetClass: null,
	graphicalCulture: null
});

// The composable sections — used for conflict resolution when loading: a section is
// "set" if it already holds a value; a partial load fills only the unset ones.
interface Section {
	id: string;
	label: string;
	isSet: (d: EmpireDraft) => boolean;
	apply: (d: EmpireDraft, e: Empire) => void;
}
const SECTIONS: Section[] = [
	{
		id: 'species',
		label: 'Species',
		isSet: (d) => d.speciesClass != null,
		apply: (d, e) => {
			d.speciesClass = e.speciesClass;
			d.speciesPortrait = e.speciesPortrait;
			if (e.name) d.name = e.name;
		}
	},
	{
		id: 'traits',
		label: 'Traits',
		isSet: (d) => d.traits.length > 0,
		apply: (d, e) => (d.traits = [...e.traits])
	},
	{
		id: 'ethics',
		label: 'Ethics',
		isSet: (d) => d.ethics.length > 0,
		apply: (d, e) => (d.ethics = [...e.ethics])
	},
	{
		id: 'civics',
		label: 'Civics',
		isSet: (d) => d.civics.length > 0,
		apply: (d, e) => (d.civics = [...e.civics])
	},
	{
		id: 'origin',
		label: 'Origin',
		isSet: (d) => d.origin != null,
		apply: (d, e) => (d.origin = e.origin)
	},
	{
		id: 'homeworld',
		label: 'Homeworld',
		isSet: (d) => d.planetClass != null,
		apply: (d, e) => (d.planetClass = e.planetClass)
	},
	{
		id: 'ship',
		label: 'Ship type',
		isSet: (d) => d.graphicalCulture != null,
		apply: (d, e) => (d.graphicalCulture = e.graphicalCulture)
	}
];

let draft = $state<EmpireDraft>(empty());
// Bumped only on a load/reset (not on in-section edits), so builder pages can detect
// an external change and re-sync (e.g. switch archetype) without feedback loops.
let generation = $state(0);

export const empire = {
	get draft() {
		return draft;
	},
	get generation() {
		return generation;
	},
	// Labels of the sections that currently hold a value (for the conflict prompt).
	setSectionLabels(): string[] {
		return SECTIONS.filter((s) => s.isSet(draft)).map((s) => s.label);
	},
	anySet(): boolean {
		return SECTIONS.some((s) => s.isSet(draft));
	},
	// 'all' overrides every section; 'partial' fills only the currently-unset ones.
	apply(e: Empire, mode: 'all' | 'partial') {
		for (const s of SECTIONS) if (mode === 'all' || !s.isSet(draft)) s.apply(draft, e);
		generation++;
	},
	reset() {
		draft = empty();
		generation++;
	},
	setTraits(t: string[]) {
		draft.traits = t;
	},
	setEthics(e: string[]) {
		draft.ethics = e;
	}
};
