import {afterEach, describe, expect, it, vi} from 'vitest';
import {RESIDUE_CLASSES} from '@/domain/residue';
import {isNonInteractive, refreshIntervalMs, residueClasses, startSession} from '@/presentation/cli/options';

vi.mock('@/presentation/config', () => ({
	createPreferenceStore: () => ({
		getLocale: () => 'en-US' as const,
		setLocale: () => undefined,
		path: '(test)',
	}),
}));

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('isNonInteractive', () => {
	it('is true when the caller asked for output rather than an interface', () => {
		expect(isNonInteractive({json: true})).toBe(true);
		expect(isNonInteractive({list: true})).toBe(true);
	});

	it('is false by default', () => {
		expect(isNonInteractive({})).toBe(false);
		expect(isNonInteractive({json: false, list: false})).toBe(false);
	});
});

describe('refreshIntervalMs', () => {
	it('defaults to five seconds', () => {
		expect(refreshIntervalMs({})).toBe(5000);
	});

	it('accepts a number, including zero to disable polling', () => {
		expect(refreshIntervalMs({interval: '250'})).toBe(250);
		expect(refreshIntervalMs({interval: '0'})).toBe(0);
	});

	it('rejects anything that is not a non-negative number', () => {
		expect(() => refreshIntervalMs({interval: 'soon'})).toThrow('non-negative');
		expect(() => refreshIntervalMs({interval: '-1'})).toThrow('non-negative');
	});
});

describe('residueClasses', () => {
	it('defaults to every class', () => {
		expect(residueClasses({})).toEqual(RESIDUE_CLASSES);
		expect(residueClasses({class: []})).toEqual(RESIDUE_CLASSES);
	});

	it('keeps an explicit selection', () => {
		expect(residueClasses({class: ['service', 'task']})).toEqual(['service', 'task']);
	});

	it('rejects an unknown class by name', () => {
		expect(() => residueClasses({class: ['nonsense']})).toThrow('--class expects one of');
	});
});

describe('startSession', () => {
	it('honours an explicit language', async () => {
		const session = await startSession({lang: 'es-VE'});
		expect(session.locale).toBe('es-VE');
		expect(session.t('views.startup')).toBe('Inicio');
	});

	it('falls back to the stored preference', async () => {
		const session = await startSession({});
		expect(session.locale).toBe('en-US');
		expect(session.t('views.startup')).toBe('Startup');
	});

	it('rejects an unsupported language by name', async () => {
		await expect(startSession({lang: 'fr-FR'})).rejects.toThrow('--lang expects one of');
	});
});
