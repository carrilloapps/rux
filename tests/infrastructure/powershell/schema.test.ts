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

describe('absent keys', () => {
	/**
	 * PowerShell omits a property entirely when it has nothing to report, which
	 * is not the same as sending it as null. Parsing each helper on its own
	 * cannot tell the two apart, so every case here goes through an object: that
	 * is where a schema decides whether the key may be missing at all.
	 *
	 * This is the shape a machine with no WSL installed produces, and it parsed
	 * only by accident until Zod 4 tightened the rule.
	 */
	const record = z.object({
		name: psString,
		version: psNumber,
		running: psBoolean,
		count: psCount(3),
		label: psText('unknown'),
	});

	it('accepts an object with every optional key missing', () => {
		expect(record.parse({})).toEqual({
			name: null,
			version: null,
			running: null,
			count: 3,
			label: 'unknown',
		});
	});

	it('treats an absent key and an explicit null alike', () => {
		const absent = record.parse({});
		const explicit = record.parse({name: null, version: null, running: null, count: null, label: null});
		expect(absent).toEqual(explicit);
	});

	it('still rejects a key present with the wrong type', () => {
		expect(() => record.parse({name: 5})).toThrow();
	});

	it('parses a list of records that each omit different keys', () => {
		const list = psArray(record);
		expect(list.parse([{name: 'Ubuntu'}, {running: true}])).toEqual([
			{name: 'Ubuntu', version: null, running: null, count: 3, label: 'unknown'},
			{name: null, version: null, running: true, count: 3, label: 'unknown'},
		]);
	});
});
