import {describe, expect, it} from 'vitest';
import {createTranslator, detectLocale, initI18n, isLocale, nextLocale, translate} from '@/i18n/translator';
import {enUS} from '@/i18n/locales/en-US';
import {esVE} from '@/i18n/locales/es-VE';
import {text} from '@/domain/common';
import {JUNK_CATALOG} from '@/domain/services/junk-catalog';
import {RESIDUE_CLASSES} from '@/domain/residue';

/** Walks an object and yields every leaf path, so locales can be compared structurally. */
function leafKeys(value: unknown, prefix = ''): string[] {
	if (typeof value !== 'object' || value === null) return [prefix];
	return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
		leafKeys(child, prefix ? `${prefix}.${key}` : key),
	);
}

describe('locale completeness', () => {
	it('defines exactly the same keys in both locales', () => {
		expect(leafKeys(esVE).sort()).toEqual(leafKeys(enUS).sort());
	});

	it('leaves no empty strings', () => {
		for (const locale of [enUS, esVE]) {
			for (const key of leafKeys(locale)) {
				const value = key
					.split('.')
					.reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], locale);
				expect(typeof value, key).toBe('string');
				expect((value as string).length, key).toBeGreaterThan(0);
			}
		}
	});

	it('covers every residue class', () => {
		for (const residueClass of RESIDUE_CLASSES) {
			expect(enUS.residue.classes).toHaveProperty(residueClass);
			expect(esVE.residue.classes).toHaveProperty(residueClass);
		}
	});

	it('covers every junk category used by the catalog', () => {
		for (const target of JUNK_CATALOG) {
			expect(enUS.junk.categories).toHaveProperty(target.category);
			expect(esVE.junk.categories).toHaveProperty(target.category);
		}
	});

	it('resolves every junk target description key', async () => {
		const i18n = await initI18n('en-US');
		const t = createTranslator(i18n);
		for (const target of JUNK_CATALOG) {
			const resolved = translate(t, target.description);
			expect(resolved, target.id).not.toBe(target.description.key);
		}
	});
});

describe('locale selection', () => {
	it('recognises supported locales', () => {
		expect(isLocale('es-VE')).toBe(true);
		expect(isLocale('fr-FR')).toBe(false);
	});

	it('detects Spanish from the environment', () => {
		expect(detectLocale({LANG: 'es_VE.UTF-8'})).toBe('es-VE');
		expect(detectLocale({LANG: 'en_US.UTF-8'})).toBe('en-US');
		expect(detectLocale({})).toBe('en-US');
	});

	it('prefers an explicit override', () => {
		expect(detectLocale({RUX_LOCALE: 'es-VE', LANG: 'en_US'})).toBe('es-VE');
	});

	it('cycles through every locale', () => {
		expect(nextLocale('en-US')).toBe('es-VE');
		expect(nextLocale('es-VE')).toBe('en-US');
	});
});

describe('translation', () => {
	it('interpolates values in both languages', async () => {
		const i18n = await initI18n('en-US');
		const english = createTranslator(i18n);
		expect(english('startup.summary', {total: 7})).toContain('7');

		await i18n.changeLanguage('es-VE');
		const spanish = createTranslator(i18n);
		expect(spanish('startup.summary', {total: 7})).toContain('7');
		expect(spanish('views.startup')).toBe('Inicio');
	});

	it('resolves domain-produced localizable text', async () => {
		const i18n = await initI18n('es-VE');
		const t = createTranslator(i18n);
		const message = text('residue.reasons.startup', {location: 'HKCU'});
		expect(translate(t, message)).toContain('HKCU');
		expect(translate(t, null)).toBe('');
	});
});
