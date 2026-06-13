// The single "current empire" the whole app works on. The builder pages (Ethics,
// Species Builder, …) bind to this shared draft; importing a predefined empire or
// loading a user_empire_designs.txt applies into it (whole or partial — see apply()).
import type { Empire, EmpireFlag } from '$lib/server/db';
import type { SerializableEmpire } from '$lib/empireFile';

// A second founding species (Syncretic Evolution / Necrophage / …). Same shape as the
// founder's species fields; null `secondary` means the empire has only one species.
export interface SecondarySpecies {
	speciesClass: string | null;
	speciesPortrait: string | null;
	speciesName: string;
	speciesPlural: string;
	speciesAdjective: string;
	traits: string[];
}

export interface EmpireDraft {
	// Player-facing names typed at empire creation (the /names section). Empty = unset.
	name: string; // empire name
	adjective: string;
	shipPrefix: string;
	speciesName: string;
	speciesPlural: string;
	speciesAdjective: string;
	rulerName: string;
	planetName: string;
	systemName: string;
	speciesClass: string | null;
	speciesPortrait: string | null;
	traits: string[];
	secondary: SecondarySpecies | null;
	ethics: string[];
	authority: string | null; // government type, e.g. "auth_imperial"
	civics: string[];
	origin: string | null;
	planetClass: string | null;
	initializer: string; // home-system initializer ('' = default/random)
	room: string; // diplomacy room backdrop ('' = default_room)
	flag: EmpireFlag | null;
	graphicalCulture: string | null;
}

const emptyFlag = (): EmpireFlag => ({
	iconCategory: null,
	iconFile: null,
	backgroundCategory: 'backgrounds',
	backgroundFile: null,
	colors: ['null', 'null', 'null', 'null']
});

const emptySecondary = (): SecondarySpecies => ({
	speciesClass: null,
	speciesPortrait: null,
	speciesName: '',
	speciesPlural: '',
	speciesAdjective: '',
	traits: []
});

// The editable name fields of the draft (string-valued), in display order.
export const NAME_FIELDS = [
	'name',
	'adjective',
	'shipPrefix',
	'speciesName',
	'speciesPlural',
	'speciesAdjective',
	'rulerName',
	'planetName',
	'systemName'
] as const;
export type NameField = (typeof NAME_FIELDS)[number];

const empty = (): EmpireDraft => ({
	name: '',
	adjective: '',
	shipPrefix: '',
	speciesName: '',
	speciesPlural: '',
	speciesAdjective: '',
	rulerName: '',
	planetName: '',
	systemName: '',
	speciesClass: null,
	speciesPortrait: null,
	traits: [],
	secondary: null,
	ethics: [],
	authority: null,
	civics: [],
	origin: null,
	planetClass: null,
	initializer: '',
	room: '',
	flag: null,
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
		id: 'names',
		label: 'Names',
		isSet: (d) => NAME_FIELDS.some((f) => d[f] !== ''),
		apply: (d, e) => {
			d.name = e.name ?? '';
			d.adjective = e.adjective ?? '';
			d.shipPrefix = e.shipPrefix ?? '';
			d.speciesName = e.speciesName ?? '';
			d.speciesPlural = e.speciesPlural ?? '';
			d.speciesAdjective = e.speciesAdjective ?? '';
			d.rulerName = e.rulerName ?? '';
			d.planetName = e.planetName ?? '';
			d.systemName = e.systemName ?? '';
		}
	},
	{
		id: 'species',
		label: 'Species',
		isSet: (d) => d.speciesClass != null,
		apply: (d, e) => {
			d.speciesClass = e.speciesClass;
			d.speciesPortrait = e.speciesPortrait;
		}
	},
	{
		id: 'traits',
		label: 'Traits',
		isSet: (d) => d.traits.length > 0,
		apply: (d, e) => (d.traits = [...e.traits])
	},
	{
		id: 'secondary',
		label: 'Secondary species',
		isSet: (d) => d.secondary != null,
		apply: (d, e) => {
			const has = !!(e.secondaryClass || e.secondaryName || (e.secondaryTraits?.length ?? 0));
			d.secondary = has
				? {
						speciesClass: e.secondaryClass ?? null,
						speciesPortrait: e.secondaryPortrait ?? null,
						speciesName: e.secondaryName ?? '',
						speciesPlural: e.secondaryPlural ?? '',
						speciesAdjective: e.secondaryAdjective ?? '',
						traits: [...(e.secondaryTraits ?? [])]
					}
				: null;
		}
	},
	{
		id: 'ethics',
		label: 'Ethics',
		isSet: (d) => d.ethics.length > 0,
		apply: (d, e) => (d.ethics = [...e.ethics])
	},
	{
		id: 'authority',
		label: 'Government',
		isSet: (d) => d.authority != null,
		apply: (d, e) => (d.authority = e.authority)
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
		isSet: (d) => d.planetClass != null || d.initializer !== '',
		apply: (d, e) => {
			d.planetClass = e.planetClass;
			d.initializer = e.initializer ?? '';
		}
	},
	{
		id: 'flag',
		label: 'Flag',
		isSet: (d) => d.flag != null,
		apply: (d, e) => (d.flag = e.flag ?? null)
	},
	{
		id: 'room',
		label: 'Room',
		isSet: (d) => d.room !== '',
		apply: (d, e) => (d.room = e.room ?? '')
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
	setName(field: NameField, value: string) {
		draft[field] = value;
	},
	setTraits(t: string[]) {
		draft.traits = t;
	},
	// Founder species class (also sets/clears the portrait).
	setSpeciesClass(cls: string | null, portrait: string | null = null) {
		draft.speciesClass = cls;
		draft.speciesPortrait = cls ? portrait : null;
	},
	// ── Secondary founding species ──────────────────────────────────────────
	addSecondary() {
		if (!draft.secondary) draft.secondary = emptySecondary();
	},
	removeSecondary() {
		draft.secondary = null;
	},
	setSecondaryClass(cls: string | null, portrait: string | null = null) {
		if (!draft.secondary) draft.secondary = emptySecondary();
		draft.secondary.speciesClass = cls;
		draft.secondary.speciesPortrait = cls ? portrait : null;
	},
	setSecondaryTraits(t: string[]) {
		if (!draft.secondary) draft.secondary = emptySecondary();
		draft.secondary.traits = t;
	},
	setSecondaryName(field: 'speciesName' | 'speciesPlural' | 'speciesAdjective', value: string) {
		if (!draft.secondary) draft.secondary = emptySecondary();
		draft.secondary[field] = value;
	},
	setEthics(e: string[]) {
		draft.ethics = e;
	},
	setAuthority(a: string | null) {
		draft.authority = a;
	},
	setOrigin(o: string | null) {
		draft.origin = o;
	},
	setCivics(c: string[]) {
		draft.civics = c;
	},
	toggleCivic(key: string) {
		draft.civics = draft.civics.includes(key)
			? draft.civics.filter((c) => c !== key)
			: [...draft.civics, key];
	},
	setPlanetClass(p: string | null) {
		draft.planetClass = p;
	},
	setInitializer(v: string) {
		draft.initializer = v;
	},
	setRoom(v: string) {
		draft.room = v;
	},
	// ── Empire flag ─────────────────────────────────────────────────────────
	addFlag() {
		if (!draft.flag) draft.flag = emptyFlag();
	},
	removeFlag() {
		draft.flag = null;
	},
	updateFlag(patch: Partial<EmpireFlag>) {
		if (!draft.flag) draft.flag = emptyFlag();
		draft.flag = { ...draft.flag, ...patch };
	},
	setFlagColor(index: number, key: string) {
		if (!draft.flag) draft.flag = emptyFlag();
		const colors = [...draft.flag.colors];
		while (colors.length < 4) colors.push('null');
		colors[index] = key;
		draft.flag = { ...draft.flag, colors };
	},
	// Ship type: stored as a representative graphical_culture ('biogenesis_01' = organic).
	setShipType(t: 'regular' | 'organic' | null) {
		draft.graphicalCulture = t === 'organic' ? 'biogenesis_01' : t === 'regular' ? 'regular' : null;
	},
	// Flatten the draft (incl. the nested secondary species) into the shape the empire-
	// file serializer expects. Empty name strings become null so they're omitted.
	toSerializable(): SerializableEmpire {
		const s = draft.secondary;
		return {
			name: draft.name || null,
			adjective: draft.adjective || null,
			shipPrefix: draft.shipPrefix || null,
			speciesClass: draft.speciesClass,
			speciesPortrait: draft.speciesPortrait,
			speciesName: draft.speciesName || null,
			speciesPlural: draft.speciesPlural || null,
			speciesAdjective: draft.speciesAdjective || null,
			secondaryClass: s?.speciesClass ?? null,
			secondaryPortrait: s?.speciesPortrait ?? null,
			secondaryName: s?.speciesName || null,
			secondaryPlural: s?.speciesPlural || null,
			secondaryAdjective: s?.speciesAdjective || null,
			secondaryTraits: s?.traits ?? [],
			rulerName: draft.rulerName || null,
			authority: draft.authority,
			origin: draft.origin,
			planetName: draft.planetName || null,
			planetClass: draft.planetClass,
			systemName: draft.systemName || null,
			initializer: draft.initializer || null,
			room: draft.room || null,
			flag: draft.flag,
			graphicalCulture: draft.graphicalCulture,
			ethics: draft.ethics,
			civics: draft.civics,
			traits: draft.traits
		};
	}
};
