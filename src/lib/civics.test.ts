import { describe, it, expect } from 'vitest';
import type { CivicRequirement, Modifier } from '$lib/server/db';
import { civicTypeLabel, prettyKey, formatModifierValue, civicRequirementLines } from './civics';

const req = (kind: string, operator: string, value: string, groupId = 0): CivicRequirement => ({
	kind,
	operator,
	value,
	groupId
});
const mod = (key: string, value: number, positiveIsGood = true): Modifier => ({
	key,
	value,
	label: null,
	positiveIsGood
});

describe('civicTypeLabel', () => {
	it('maps the internal type to a display word', () => {
		expect(civicTypeLabel('normal')).toBe('Regular');
		expect(civicTypeLabel('gestalt')).toBe('Gestalt');
		expect(civicTypeLabel('corporate')).toBe('Corporate');
	});
});

describe('prettyKey', () => {
	it('strips the gating prefix and title-cases', () => {
		expect(prettyKey('auth_corporate')).toBe('Corporate');
		expect(prettyKey('ethic_materialist')).toBe('Materialist');
		expect(prettyKey('civic_shared_burden')).toBe('Shared Burden');
		expect(prettyKey('origin_lithoid')).toBe('Lithoid');
	});
	it('keeps the Fanatic qualifier on fanatic ethics', () => {
		expect(prettyKey('ethic_fanatic_materialist')).toBe('Fanatic Materialist');
	});
});

describe('formatModifierValue', () => {
	it('shows flat _add as a raw number and _mult as a percentage', () => {
		expect(formatModifierValue(mod('country_scientist_cap_add', 1))).toBe('+1');
		expect(formatModifierValue(mod('country_official_cap_add', -1))).toBe('-1');
		expect(formatModifierValue(mod('planet_jobs_worker_produces_mult', 0.1))).toBe('+10%');
	});
	it('treats fractional percent families (happiness/habitability/attraction/…) as %', () => {
		expect(formatModifierValue(mod('refugee_attraction', 0.15))).toBe('+15%');
		expect(formatModifierValue(mod('pop_happiness', 0.1))).toBe('+10%');
		expect(formatModifierValue(mod('pc_continental_habitability', 0.1))).toBe('+10%');
		expect(formatModifierValue(mod('habitability_floor_add', 0.25))).toBe('+25%');
		expect(formatModifierValue(mod('all_technology_research_speed', 0.1))).toBe('+10%');
		expect(formatModifierValue(mod('citizen_pop_same_species_class_happiness', 0.075))).toBe(
			'+7.5%'
		);
	});
	it('keeps flat fractional _add amounts as raw numbers (not %)', () => {
		expect(formatModifierValue(mod('country_ethic_influence_produces_add', 0.5))).toBe('+0.5');
		expect(formatModifierValue(mod('planet_bureaucrats_society_research_produces_add', 1.5))).toBe(
			'+1.5'
		);
		expect(formatModifierValue(mod('monthly_loyalty', 0.5))).toBe('+0.5');
		expect(formatModifierValue(mod('commander_initial_skill', 2))).toBe('+2');
	});
	it('handles _mult variants and _perc suffixes', () => {
		expect(formatModifierValue(mod('ship_anomaly_research_speed_mult_uninhabitable', 0.25))).toBe(
			'+25%'
		);
		expect(formatModifierValue(mod('ship_hull_regen_add_perc', 0.05))).toBe('+5%');
		expect(formatModifierValue(mod('science_ship_survey_speed', 0.2))).toBe('+20%');
	});
});

describe('civicRequirementLines', () => {
	it('collapses an OR set into one "A or B" requires line', () => {
		const lines = civicRequirementLines([
			req('ethic', 'require_any', 'ethic_materialist', 1),
			req('ethic', 'require_any', 'ethic_fanatic_materialist', 1)
		]);
		expect(lines).toEqual([{ type: 'require', text: 'Materialist or Fanatic Materialist' }]);
	});
	it('renders require → require line and forbid → exclude line', () => {
		const lines = civicRequirementLines([
			req('authority', 'forbid', 'auth_corporate'),
			req('civic', 'forbid', 'civic_shared_burden'),
			req('authority', 'require', 'auth_machine_intelligence')
		]);
		expect(lines).toContainEqual({ type: 'require', text: 'Machine Intelligence' });
		expect(lines).toContainEqual({ type: 'exclude', text: 'Corporate' });
		expect(lines).toContainEqual({ type: 'exclude', text: 'Shared Burden' });
	});
	it('renders ship-type gates with a "ships" suffix', () => {
		expect(civicRequirementLines([req('ship_type', 'forbid', 'organic')])).toEqual([
			{ type: 'exclude', text: 'Organic ships' }
		]);
		expect(civicRequirementLines([req('ship_type', 'require_any', 'organic', 1)])).toEqual([
			{ type: 'require', text: 'Organic ships' }
		]);
	});
});
