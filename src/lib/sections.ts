// Anchor ids and "Jump to" links for a page's grouped sections.

/** A stable, URL-safe anchor id for a section label ("Gestalt · Machine" → "sec-gestalt-machine"). */
export const sectionId = (label: string): string =>
	'sec-' +
	(label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'other');

/** JumpLinks entries for the non-empty groups, in page order. */
export const sectionLinks = (
	groups: { label: string; items?: unknown[] }[]
): { id: string; label: string; strong?: boolean }[] =>
	groups
		.filter((g) => !g.items || g.items.length)
		.map((g) => ({ id: sectionId(g.label), label: g.label }));
