// Shared ethics helpers: the axes and point budget, the "Gameplay Implications" /
// policy-restriction aggregation and the monument-planet ethic bonus table. Used by both the Ethics page and the Empire
// summary so the two stay in lockstep.
import type { Ethic } from '#lib/server/db/index.ts';

const ethicSource = (e: Ethic) => e.label ?? e.key;

// Opposite pairs of regular ethics, one axis each (fanatic forms share their regular's).
export const ETHIC_AXES: [string, string][] = [
	['ethic_authoritarian', 'ethic_egalitarian'],
	['ethic_xenophobe', 'ethic_xenophile'],
	['ethic_militarist', 'ethic_pacifist'],
	['ethic_spiritualist', 'ethic_materialist']
];
export const ETHIC_BUDGET = 3;

// One implication/restriction line and which selected ethics contribute it.
export interface SourcedItem {
	label: string;
	sources: string[];
}

// Deduplicated gameplay implications across the given ethics, tracking their sources.
export function combineImplications(ethics: Ethic[]): SourcedItem[] {
	const seen = new Map<string, SourcedItem>();
	for (const ethic of ethics) {
		for (const imp of ethic.implications) {
			if (seen.has(imp.tag)) seen.get(imp.tag)!.sources.push(ethicSource(ethic));
			else seen.set(imp.tag, { label: imp.label, sources: [ethicSource(ethic)] });
		}
	}
	return [...seen.values()];
}

// Deduplicated policy restrictions across the given ethics, tracking their sources.
export function combinePolicyRestrictions(ethics: Ethic[]): SourcedItem[] {
	const seen = new Map<string, SourcedItem>();
	for (const ethic of ethics) {
		for (const pr of ethic.policyRestrictions) {
			const id = `${pr.policyKey}:${pr.optionKey}`;
			const label = pr.optionLabel ?? pr.optionKey;
			if (seen.has(id)) seen.get(id)!.sources.push(ethicSource(ethic));
			else seen.set(id, { label, sources: [ethicSource(ethic)] });
		}
	}
	return [...seen.values()];
}

// Ethic bonuses on a monument planet, per 100 workforce of each job (4.6.0 game files). Civilians
// get theirs only on a colony with a monument, memorial, artist patron or lifecrypt
// (`has_ethics_output`, common/scripted_triggers/01_scripted_triggers_jobs.txt), scaled ×1/×2/×3
// (`scripted_ethics_weight_mult`; common/inline_scripts/jobs/ethic_job_resources.txt and
// ethic_job_modifiers.txt). Those buildings also add Culture Worker jobs, whose own ethic bonuses
// scale ×1/×2/×4 (`culture_worker`, common/pop_jobs/02_specialist_jobs.txt). Absolute ethics are
// only gained in play. Confirmed in game (4.6.0, 2026-11-23): a fanatic xenophile's 1958 civilian
// workforce gave Pop Upkeep −24.47 % (19.58 × 1.25 %) despite the patch notes. Gestalts have
// none: civilians are non-gestalt, maintenance drones get no ethic bonus.
export type MonumentJob = 'Civilians' | 'Culture Workers';
export type MonumentRow = {
	job: MonumentJob;
	label: string;
	regular: string;
	fanatic: string;
	absolute: string;
	good: boolean;
};
const civ = (label: string, regular: string, fanatic: string, absolute: string, good = true) =>
	({ job: 'Civilians', label, regular, fanatic, absolute, good }) as MonumentRow;
const cw = (label: string, regular: string, fanatic: string, absolute: string, good = true) =>
	({ job: 'Culture Workers', label, regular, fanatic, absolute, good }) as MonumentRow;
export const MONUMENT_BONUSES: { ethicKey: string; rows: MonumentRow[] }[] = [
	{
		ethicKey: 'ethic_authoritarian',
		rows: [civ('Edict Fund', '+1', '+2', '+3'), cw('Ruler Political Power', '+5%', '+10%', '+20%')]
	},
	{
		ethicKey: 'ethic_egalitarian',
		rows: [civ('Trade', '+0.5', '+1', '+1.5'), cw('Trade', '+1', '+2', '+4')]
	},
	{
		ethicKey: 'ethic_materialist',
		rows: [
			civ('Physics, Society, Engineering each', '+0.1', '+0.2', '+0.3'),
			cw('Physics, Society, Engineering each', '+0.25', '+0.5', '+1')
		]
	},
	{
		ethicKey: 'ethic_spiritualist',
		rows: [civ('Unity', '+0.25', '+0.5', '+0.75'), cw('Unity', '+0.5', '+1', '+2')]
	},
	{
		ethicKey: 'ethic_militarist',
		rows: [
			civ('Naval Capacity', '+0.125', '+0.25', '+0.375'),
			cw('Naval Capacity', '+1', '+2', '+4')
		]
	},
	{
		ethicKey: 'ethic_pacifist',
		rows: [civ('Amenities', '+100', '+200', '+300'), cw('Amenities', '+200', '+400', '+800')]
	},
	{
		ethicKey: 'ethic_xenophobe',
		rows: [
			civ('Citizen Happiness', '+0.625%', '+1.25%', '+1.875%'),
			cw('Citizen Happiness', '+1%', '+2%', '+4%')
		]
	},
	{
		ethicKey: 'ethic_xenophile',
		rows: [civ('Pop Upkeep', '−0.625%', '−1.25%', '−1.875%'), cw('Pop Upkeep', '−1%', '−2%', '−4%')]
	}
];
