// Small helpers for a value that is computed once and then shared.

/** `f`, run on the first call only; later calls return that first result. */
export function once<T>(f: () => T): () => T {
	let result: { value: T } | undefined;
	return () => (result ??= { value: f() }).value;
}

/** Freezes `value` and everything it holds, so a write to shared data throws instead of leaking. */
export function deepFreeze<T>(value: T): T {
	if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
	Object.freeze(value);
	for (const v of Object.values(value)) deepFreeze(v);
	return value;
}
