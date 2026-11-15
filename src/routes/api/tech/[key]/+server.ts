import { error, json } from '@sveltejs/kit';
import { loadTechCard } from '#lib/server/db/index.ts';

// One tech's card for its tooltip (`TechPopup`), fetched on first hover so pages need not carry
// every tech's.
export function GET({ params }) {
	const card = loadTechCard(params.key);
	if (!card) error(404, 'no such tech');
	return json(card);
}
