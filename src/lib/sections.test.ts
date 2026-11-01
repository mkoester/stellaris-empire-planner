import { describe, it, expect } from 'vitest';
import { sectionId, sectionLinks } from './sections';

describe('sectionId', () => {
	it('slugs a label', () => {
		expect(sectionId('Gestalt · Machine')).toBe('sec-gestalt-machine');
		expect(sectionId('  Regular  ')).toBe('sec-regular');
	});
	it('never yields a bare prefix', () => {
		expect(sectionId('—')).toBe('sec-other');
	});
});

describe('sectionLinks', () => {
	it('keeps order and skips empty groups', () => {
		expect(
			sectionLinks([{ label: 'A', items: [1] }, { label: 'B', items: [] }, { label: 'C' }])
		).toEqual([
			{ id: 'sec-a', label: 'A' },
			{ id: 'sec-c', label: 'C' }
		]);
	});
});
