// Pure helpers for the Ambitions page: an objective's reward formula as one readable line.
import type { RewardStep } from '#lib/server/db/index.ts';

const COUNTS: Record<string, string> = {
	count_playable_country: 'playable empires',
	num_galaxy_systems: 'galaxy systems',
	count_galcom_member: 'Galactic Community members',
	last_ideology_increase: "last month's Ideological Strength gain"
};

const fmt = (n: number) =>
	(Number.isInteger(n) ? n : parseFloat(n.toFixed(3))).toLocaleString('en');

function term(s: RewardStep): string {
	if (s.by) {
		const setup = s.by.startsWith('galaxy_setup:');
		const name = setup
			? `the ${s.by.slice('galaxy_setup:'.length).replace(/_/g, ' ')} setting`
			: (COUNTS[s.by] ?? s.by.replace(/_/g, ' '));
		return s.mult !== undefined ? `${fmt(s.mult)} × ${name}` : name;
	}
	if (s.var) return s.var.replace(/^root\./, '').replace(/_/g, ' ');
	return s.value !== undefined ? fmt(s.value) : '?';
}

// [{base 700}, {subtract 25 × playable empires}, {round_to 50}, {min 100}] →
// "700 − 25 × playable empires, rounded to 50, at least 100".
export function rewardText(steps: RewardStep[]): string {
	let expr = '';
	const after: string[] = [];
	for (const s of steps) {
		switch (s.op) {
			case 'base':
				expr = term(s);
				break;
			case 'add':
				expr = expr ? `${expr} + ${term(s)}` : term(s);
				break;
			case 'subtract':
				expr = `${expr || '0'} − ${term(s)}`;
				break;
			case 'multiply':
				expr = `(${expr || '0'}) × ${term(s)}`;
				break;
			case 'divide':
				expr = `${expr || '0'} ÷ ${term(s)}`;
				break;
			case 'round':
				after.push('rounded');
				break;
			case 'ceiling':
				after.push('rounded up');
				break;
			case 'round_to':
				after.push(`rounded to ${term(s)}`);
				break;
			case 'min':
				after.push(`at least ${term(s)}`);
				break;
			case 'max':
				after.push(`at most ${term(s)}`);
				break;
			default:
				after.push(s.op.replace(/_/g, ' '));
		}
	}
	return [expr || '—', ...after].join(', ');
}
