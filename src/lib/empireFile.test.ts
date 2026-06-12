import { describe, it, expect } from 'vitest';
import { parseEmpireFile, keyName, shipTypeLabel } from './empireFile';

const SAMPLE = `
# a comment
tzynn = {
	name = "EMPIRE_DESIGN_tzynn"
	species = {
		class = "REP"
		portrait = "rep9"
		trait = "trait_strong"
		trait = "trait_resilient"
	}
	authority = "auth_imperial"
	civics = { "civic_police_state" "civic_slaver_guilds" }
	origin = "origin_default"
	ethic = "ethic_authoritarian"
	ethic = "ethic_fanatic_militarist"
	planet_class = "pc_desert"
	graphical_culture = "reptilian_01"
}
"My Custom Empire" = {
	name = { key = "My Custom Empire" }
	species = { class = "MAM" trait = "trait_intelligent" }
	authority = "auth_democratic"
	civics = { "civic_meritocracy" }
	origin = "origin_shattered_ring"
	ethic = "ethic_egalitarian"
	graphical_culture = "biogenesis_01"
}
`;

describe('parseEmpireFile', () => {
	const empires = parseEmpireFile(SAMPLE);

	it('parses every empire in a multi-empire file', () => {
		expect(empires).toHaveLength(2);
	});
	it('reads scalar fields, the species block, and repeated/list keys', () => {
		const e = empires[0];
		expect(e.name).toBe('EMPIRE_DESIGN_tzynn');
		expect(e.speciesClass).toBe('REP');
		expect(e.traits).toEqual(['trait_strong', 'trait_resilient']);
		expect(e.civics).toEqual(['civic_police_state', 'civic_slaver_guilds']);
		expect(e.ethics).toEqual(['ethic_authoritarian', 'ethic_fanatic_militarist']);
		expect(e.planetClass).toBe('pc_desert');
		expect(e.source).toBe('file');
	});
	it('handles the name = { key = … } form and a single-civic list', () => {
		const e = empires[1];
		expect(e.name).toBe('My Custom Empire');
		expect(e.civics).toEqual(['civic_meritocracy']);
		expect(e.ethics).toEqual(['ethic_egalitarian']);
	});
	it('ignores non-empire blocks (no species)', () => {
		expect(parseEmpireFile('foo = { bar = 1 }')).toEqual([]);
	});
});

describe('keyName', () => {
	it('prefers the names map, else strips a prefix and title-cases', () => {
		expect(keyName('ethic_materialist', { ethic_materialist: 'Materialist' })).toBe('Materialist');
		expect(keyName('trait_rapid_breeders', {})).toBe('Rapid Breeders');
		expect(keyName('auth_imperial', {})).toBe('Imperial');
		expect(keyName('ethic_fanatic_militarist', {})).toBe('Fanatic Militarist');
		expect(keyName(null, {})).toBe('—');
	});
});

describe('shipTypeLabel', () => {
	it('flags biogenesis appearances as organic', () => {
		expect(shipTypeLabel('biogenesis_01')).toBe('Organic (bio-ships)');
		expect(shipTypeLabel('reptilian_01')).toBe('Regular');
		expect(shipTypeLabel(null)).toBe('Regular');
	});
});
