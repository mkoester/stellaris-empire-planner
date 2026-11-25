// Whether the consent banner is open. Module-level $state is one copy per server process, so
// it is written only from the browser (effects and event handlers), never during SSR.
import { consentCookie, consentFrom, parseConsent } from '#lib/analytics.ts';

export const consent = $state({ open: false });

const secure = () => location.protocol === 'https:';

/** On mount: open the banner if the visitor has not answered yet. */
export function checkConsent() {
	consent.open = parseConsent(consentFrom(document.cookie)) === undefined;
}

export function answer(ok: boolean) {
	document.cookie = consentCookie(ok ? crypto.randomUUID() : 'no', secure());
	consent.open = false;
}

/** "Cookie settings": withdraw the answer (and the id with it) and ask again. */
export function reopen() {
	document.cookie = consentCookie('', secure(), 0);
	consent.open = true;
}
