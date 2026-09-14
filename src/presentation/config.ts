import Conf from 'conf';
import {z} from 'zod';
import {LOCALES, type Locale, detectLocale} from '@/i18n/translator';

const preferencesSchema = z.object({
	locale: z.enum(LOCALES).optional(),
});

export type Preferences = z.infer<typeof preferencesSchema>;

/**
 * Persisted user preferences.
 *
 * Only choices the user makes inside the UI live here. Anything that describes
 * the machine is re-read on every run, because a cached answer about hardware
 * would eventually be a wrong one.
 */
export interface PreferenceStore {
	getLocale(): Locale;
	setLocale(locale: Locale): void;
	readonly path: string;
}

export function createPreferenceStore(): PreferenceStore {
	const store = new Conf<Preferences>({
		projectName: 'rux',
		configName: 'preferences',
		defaults: {},
	});

	return {
		getLocale(): Locale {
			const stored = store.get('locale');
			const parsed = preferencesSchema.shape.locale.safeParse(stored);
			return parsed.success && parsed.data ? parsed.data : detectLocale();
		},
		setLocale(locale: Locale): void {
			store.set('locale', locale);
		},
		get path(): string {
			return store.path;
		},
	};
}

/** An in-memory store for tests and for `--no-save` style flows. */
export function createEphemeralPreferenceStore(initial?: Locale): PreferenceStore {
	let locale: Locale = initial ?? detectLocale();
	return {
		getLocale: () => locale,
		setLocale: (next: Locale) => {
			locale = next;
		},
		path: '(memory)',
	};
}
