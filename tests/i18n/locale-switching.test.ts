import {afterAll, describe, expect, it} from 'vitest';
import {createTranslator, initI18n, setLocale} from '@/i18n/translator';

/**
 * Lives apart from the locale-integrity suite because it mutates the shared
 * i18next instance, and the restore in afterAll keeps other suites unaffected.
 */
afterAll(async () => {
	await initI18n('en-US');
});

describe('setLocale', () => {
	it('changes the language of the live instance', async () => {
		const i18n = await initI18n('en-US');
		const t = createTranslator(i18n);
		expect(t('views.startup')).toBe('Startup');

		await setLocale('es-VE');
		expect(t('views.startup')).toBe('Inicio');

		await setLocale('en-US');
		expect(t('views.startup')).toBe('Startup');
	});

	it('reuses the instance rather than creating a second one', async () => {
		const first = await initI18n('en-US');
		const second = await initI18n('es-VE');
		expect(second).toBe(first);
		expect(second.language).toBe('es-VE');
	});
});
