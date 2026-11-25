// The site operator's details for the imprint and the privacy policy. They are read from the
// deployment's env (override.env on the server), so no name or address sits in the public repo.
import { OPERATOR_ADDRESS, OPERATOR_EMAIL, OPERATOR_NAME } from '$app/env/private';
import { operatorFrom } from '#lib/analytics.ts';

export const operator = () => operatorFrom(OPERATOR_NAME, OPERATOR_ADDRESS, OPERATOR_EMAIL);
