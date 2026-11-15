import { describe, it, expect } from 'vitest';
import { deepFreeze, once } from '#lib/once.ts';

describe('once', () => {
	it('runs the function on the first call only', () => {
		let calls = 0;
		const get = once(() => ({ n: ++calls }));
		expect(get()).toBe(get());
		expect(calls).toBe(1);
	});
	it('remembers a falsy result too', () => {
		let calls = 0;
		const get = once(() => (calls++, null));
		get();
		get();
		expect(calls).toBe(1);
	});
});

describe('deepFreeze', () => {
	it('makes a write anywhere inside throw', () => {
		const v = deepFreeze({ a: [1, 2], b: { c: 'x' } });
		expect(() => v.a.push(3)).toThrow(TypeError);
		expect(() => v.a.sort()).toThrow(TypeError);
		expect(() => ((v.b as { c: string }).c = 'y')).toThrow(TypeError);
	});
	it('passes primitives and null through', () => {
		expect(deepFreeze(null)).toBe(null);
		expect(deepFreeze(3)).toBe(3);
	});
});
