import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {psArray, psBoolean, psCount, psNumber, psString, psText} from '@/infrastructure/powershell/schema';

/**
 * These schemas exist to absorb the shapes PowerShell's ConvertTo-Json actually
 * produces, so the cases below are the real payloads that used to break parsing
 * rather than hypothetical ones.
 */

describe('psArray', () => {
	const schema = psArray(z.object({id: z.string()}));

	it('parses a normal array', () => {
		expect(schema.parse([{id: 'a'}, {id: 'b'}])).toHaveLength(2);
	});

	it('wraps the bare object ConvertTo-Json emits for a single item', () => {
		expect(schema.parse({id: 'a'})).toEqual([{id: 'a'}]);
	});

	it('treats an absent collection as empty', () => {
		expect(schema.parse(null)).toEqual([]);
		expect(schema.parse(undefined)).toEqual([]);
	});

	it('still rejects elements of the wrong shape', () => {
		expect(() => schema.parse([{id: 42}])).toThrow();
	});
});

describe('psString', () => {
	it('keeps a real string', () => {
		expect(psString.parse('value')).toBe('value');
	});

	it.each([null, undefined, ''])('normalises %s to null', input => {
		expect(psString.parse(input)).toBeNull();
	});

	it('rejects a non-string', () => {
		expect(() => psString.parse(5)).toThrow();
	});
});

describe('psNumber', () => {
	it('keeps a real number, including zero', () => {
		expect(psNumber.parse(0)).toBe(0);
		expect(psNumber.parse(-3)).toBe(-3);
	});

	it.each([null, undefined])('normalises %s to null', input => {
		expect(psNumber.parse(input)).toBeNull();
	});
});

describe('psBoolean', () => {
	it('keeps both boolean values', () => {
		expect(psBoolean.parse(true)).toBe(true);
		expect(psBoolean.parse(false)).toBe(false);
	});

	it.each([null, undefined])('normalises %s to null', input => {
		expect(psBoolean.parse(input)).toBeNull();
	});
});

describe('psCount', () => {
	it('keeps a finite number', () => {
		expect(psCount().parse(12)).toBe(12);
	});

	it.each([null, undefined])('falls back for %s', input => {
		expect(psCount(7).parse(input)).toBe(7);
	});

	it('defaults the fallback to zero', () => {
		expect(psCount().parse(null)).toBe(0);
	});
});

describe('psText', () => {
	it('keeps a real string, including an empty one', () => {
		expect(psText().parse('value')).toBe('value');
		expect(psText().parse('')).toBe('');
	});

	it.each([null, undefined])('falls back for %s', input => {
		expect(psText('none').parse(input)).toBe('none');
	});

	it('defaults the fallback to an empty string', () => {
		expect(psText().parse(null)).toBe('');
	});
});
