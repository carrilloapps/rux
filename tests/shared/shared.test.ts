import {describe, expect, it} from 'vitest';
import {RuxError, describeError} from '@/shared/errors';
import {formatBytes, formatCount, formatDate, pad, padStart, truncate} from '@/shared/format';
import {VERSION} from '@/shared/version';

describe('RuxError', () => {
	it('reads as the message alone when there is no detail', () => {
		expect(new RuxError('failed').toString()).toBe('failed');
	});

	it('appends the detail when there is one', () => {
		expect(new RuxError('failed', 'because').toString()).toBe('failed: because');
	});

	it('keeps its own name so it can be recognised', () => {
		expect(new RuxError('failed').name).toBe('RuxError');
		expect(new RuxError('failed')).toBeInstanceOf(Error);
	});
});

describe('describeError', () => {
	it('prefers the rich description of a RuxError', () => {
		expect(describeError(new RuxError('failed', 'because'))).toBe('failed: because');
	});

	it('falls back to the message of a plain error', () => {
		expect(describeError(new TypeError('bad type'))).toBe('bad type');
	});

	it('stringifies anything else that was thrown', () => {
		expect(describeError('a bare string')).toBe('a bare string');
		expect(describeError(42)).toBe('42');
		expect(describeError(null)).toBe('null');
	});
});

describe('formatBytes', () => {
	it.each([
		[0, '-'],
		[null, '-'],
		[undefined, '-'],
		[-5, '-'],
	])('renders %s as a dash', (input, expected) => {
		expect(formatBytes(input)).toBe(expected);
	});

	it.each([
		[512, '512 B'],
		[1024, '1.0 KB'],
		[1536, '1.5 KB'],
		[1024 ** 2, '1.0 MB'],
		[1024 ** 3, '1.0 GB'],
		[1024 ** 4, '1.0 TB'],
		[1024 ** 5, '1.0 PB'],
	])('renders %i bytes as %s', (input, expected) => {
		expect(formatBytes(input)).toBe(expected);
	});

	it('drops the decimal once the number is large enough to stand alone', () => {
		expect(formatBytes(15 * 1024)).toBe('15 KB');
	});

	it('stops scaling at the largest unit it knows', () => {
		expect(formatBytes(1024 ** 6)).toContain('PB');
	});
});

describe('formatCount', () => {
	it('groups thousands', () => {
		expect(formatCount(1234567)).toBe('1,234,567');
		expect(formatCount(0)).toBe('0');
	});
});

describe('truncate', () => {
	it('leaves a short value alone', () => {
		expect(truncate('abc', 5)).toBe('abc');
		expect(truncate('abcde', 5)).toBe('abcde');
	});

	it('marks a cut with a trailing tilde', () => {
		expect(truncate('abcdef', 5)).toBe('abcd~');
	});

	it('handles widths too small for a marker', () => {
		expect(truncate('abc', 1)).toBe('a');
		expect(truncate('abc', 0)).toBe('');
		expect(truncate('abc', -1)).toBe('');
	});
});

describe('pad', () => {
	it('pads to the requested width', () => {
		expect(pad('ab', 5)).toBe('ab   ');
	});

	it('truncates before padding', () => {
		expect(pad('abcdefgh', 4)).toBe('abc~');
	});
});

describe('padStart', () => {
	it('right-aligns within the width', () => {
		expect(padStart('7', 4)).toBe('   7');
	});

	it('truncates an over-long value', () => {
		expect(padStart('abcdefgh', 4)).toBe('abc~');
	});
});

describe('formatDate', () => {
	it('renders an ISO date as a calendar day', () => {
		expect(formatDate('2026-09-14T13:45:00.000Z')).toBe('2026-09-14');
	});

	it.each([null, undefined, '', 'not a date'])('renders %s as a dash', input => {
		expect(formatDate(input)).toBe('-');
	});
});

describe('VERSION', () => {
	it('is a semantic version', () => {
		expect(VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
	});

	it('falls back to a development marker when nothing was injected', () => {
		// Tests run from source, where tsup has not replaced the build-time global.
		expect(VERSION).toBe('0.0.0-dev');
	});
});
