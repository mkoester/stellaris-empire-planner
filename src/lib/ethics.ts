// Shared ethics helpers: the "Gameplay Implications" / policy-restriction aggregation
// and the monument-bonus reference table. Used by both the Ethics page and the Empire
// summary so the two stay in lockstep.
import type { Ethic } from '$lib/server/db';

const ethicSource = (e: Ethic) => e.label ?? e.key;

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

// Monument bonuses per 100 civilian pops, by ethic (values from the wiki — the in-game
// monument buildings grant these scaling bonuses based on the empire's governing ethics).
export type MonumentRow = { label: string; regular: string; fanatic?: string; good: boolean };
export const MONUMENT_BONUSES: { ethicKey: string; rows: MonumentRow[] }[] = [
	{
		ethicKey: 'ethic_authoritarian',
		rows: [{ label: 'Edict Fund', regular: '+1', fanatic: '+2', good: true }]
	},
	{
		ethicKey: 'ethic_egalitarian',
		rows: [{ label: 'Trade Value', regular: '+0.5', fanatic: '+1', good: true }]
	},
	{
		ethicKey: 'ethic_materialist',
		rows: [{ label: 'Research', regular: '+0.1', fanatic: '+0.2', good: true }]
	},
	{
		ethicKey: 'ethic_spiritualist',
		rows: [{ label: 'Unity', regular: '+0.25', fanatic: '+0.5', good: true }]
	},
	{
		ethicKey: 'ethic_militarist',
		rows: [{ label: 'Naval Capacity', regular: '+0.125', fanatic: '+0.25', good: true }]
	},
	{
		ethicKey: 'ethic_pacifist',
		rows: [{ label: 'Amenities', regular: '+100', fanatic: '+200', good: true }]
	},
	{
		ethicKey: 'ethic_xenophobe',
		rows: [{ label: 'Happiness', regular: '+0.625%', fanatic: '+1.25%', good: true }]
	},
	{
		ethicKey: 'ethic_xenophile',
		rows: [{ label: 'Pop Upkeep', regular: '−0.625%', fanatic: '−1.25%', good: true }]
	},
	{
		ethicKey: 'ethic_gestalt_consciousness',
		rows: [
			{ label: 'Unity', regular: '+0.1', good: true },
			{ label: 'Trade Value', regular: '+0.1', good: true },
			{ label: 'Minerals Upkeep', regular: '+0.2', good: false }
		]
	}
];
