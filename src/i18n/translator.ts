import i18next, {type i18n as I18nInstance} from 'i18next';
import type {LocalizableText} from '@/domain/common';
import {enUS} from '@/i18n/locales/en-US';
import {esVE} from '@/i18n/locales/es-VE';

export const LOCALES = ['en-US', 'es-VE'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Readonly<Record<Locale, string>> = Object.freeze({
	'en-US': 'English (US)',
	'es-VE': 'Espanol (VE)',
});

export function isLocale(value: string): value is Locale {
	return (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks a starting language from the environment.
 *
 * Windows exposes the user's UI language through these variables in most
 * terminals; anything Spanish maps to the Venezuelan locale, everything else
 * falls back to English.
 */
export function detectLocale(environment: NodeJS.ProcessEnv = process.env): Locale {
	const candidate =
		environment.RUX_LOCALE ?? environment.LC_ALL ?? environment.LANG ?? environment.LANGUAGE ?? '';
	const normalized = candidate.replace('_', '-').toLowerCase();
	if (normalized.startsWith('es')) return 'es-VE';
	if (normalized.startsWith('en')) return 'en-US';
	return 'en-US';
}

let instance: I18nInstance | null = null;

export async function initI18n(locale: Locale): Promise<I18nInstance> {
	if (instance) {
		await instance.changeLanguage(locale);
		return instance;
	}

	instance = i18next.createInstance();
	await instance.init({
		lng: locale,
		fallbackLng: 'en-US',
		supportedLngs: [...LOCALES],
		resources: {
			'en-US': {translation: enUS},
			'es-VE': {translation: esVE},
		},
		interpolation: {
			// Terminal output is never HTML, so escaping would corrupt real paths.
			escapeValue: false,
		},
		// The UI reads keys synchronously during render.
		initImmediate: false,
	});

	return instance;
}

export type Translator = (key: string, values?: Record<string, string | number>) => string;

export function createTranslator(i18n: I18nInstance): Translator {
	return (key, values) => i18n.t(key, values ?? {});
}

/** Resolves a domain-produced `LocalizableText` through the active translator. */
export function translate(t: Translator, message: LocalizableText | null): string {
	if (!message) return '';
	return t(message.key, message.values);
}

export async function setLocale(locale: Locale): Promise<void> {
	if (instance) await instance.changeLanguage(locale);
}

export function nextLocale(current: Locale): Locale {
	const index = LOCALES.indexOf(current);
	return LOCALES[(index + 1) % LOCALES.length]!;
}
