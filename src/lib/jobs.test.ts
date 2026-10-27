import { describe, it, expect } from 'vitest';
import { workedOutput } from '$lib/jobs';

const job = (amount: number, resources: [string, string, number][]) => ({
	job: 'x',
	name: null,
	amount,
	resources: resources.map(([kind, resource, n]) => ({
		kind: kind as 'produces' | 'upkeep',
		resource,
		amount: n
	}))
});

describe('workedOutput', () => {
	it('scales each job by its workforce (per 100) and nets upkeep against output', () => {
		const artisan = job(200, [
			['produces', 'consumer_goods', 6],
			['upkeep', 'minerals', 6]
		]);
		expect(workedOutput([artisan])).toEqual([
			{ resource: 'consumer_goods', amount: 12 },
			{ resource: 'minerals', amount: -12 }
		]);
	});

	it('sums resources across jobs and drops those that cancel out', () => {
		const lab = (r: string) =>
			job(60, [
				['produces', r, 3],
				['upkeep', 'consumer_goods', 1.5]
			]);
		expect(
			workedOutput([
				lab('physics_research'),
				lab('society_research'),
				job(30, [['produces', 'consumer_goods', 6]])
			])
		).toEqual([
			{ resource: 'physics_research', amount: 1.8 },
			{ resource: 'society_research', amount: 1.8 }
		]);
	});
});
