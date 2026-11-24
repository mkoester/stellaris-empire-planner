import { describe, it, expect } from 'vitest';
import { rewardText } from '#lib/ambitions.ts';

describe('rewardText', () => {
	it('reads the steps in order', () => {
		expect(
			rewardText([
				{ op: 'base', value: 700 },
				{ op: 'subtract', by: 'count_playable_country', mult: 25 },
				{ op: 'round_to', value: 50 },
				{ op: 'min', value: 100 }
			])
		).toBe('700 − 25 × playable empires, rounded to 50, at least 100');
	});

	it('names galaxy setup values, variables and unknown counts', () => {
		expect(
			rewardText([
				{ op: 'base', value: 3000 },
				{ op: 'divide', by: 'num_galaxy_systems' },
				{ op: 'divide', by: 'galaxy_setup:habitable_worlds_scale' },
				{ op: 'ceiling' }
			])
		).toBe('3,000 ÷ galaxy systems ÷ the habitable worlds scale setting, rounded up');
		expect(
			rewardText([
				{ op: 'base', value: 1 },
				{ op: 'multiply', var: 'root.x_var' }
			])
		).toBe('(1) × x var');
		expect(rewardText([{ op: 'add', by: 'some_count' }])).toBe('some count');
		expect(rewardText([])).toBe('—');
	});
});
