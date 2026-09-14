import {RESIDUE_CLASSES, isResidueClass, type ResidueClass} from '@/domain/residue';
import {LOCALES, createTranslator, initI18n, isLocale, type Locale, type Translator} from '@/i18n/translator';
import {RuxError} from '@/shared/errors';
import {createPreferenceStore} from '@/presentation/config';

/** Every flag the program accepts, as commander hands them over. */
export interface CliOptions {
	readonly lang?: string;
	readonly json?: boolean;
	readonly list?: boolean;
	readonly tasks?: boolean;
	readonly deep?: boolean;
	readonly yes?: boolean;
	readonly dryRun?: boolean;
	readonly readOnly?: boolean;
	readonly interval?: string;
	readonly class?: readonly string[];
}

export interface Session {
	readonly t: Translator;
	readonly locale: Locale;
}

/** True when the command should print instead of opening the interface. */
export function isNonInteractive(options: CliOptions): boolean {
	return options.json === true || options.list === true;
}

export function refreshIntervalMs(options: CliOptions): number {
	if (options.interval === undefined) return 5000;
	const value = Number(options.interval);
	if (!Number.isFinite(value) || value < 0) {
		throw new RuxError('--interval expects a non-negative number of milliseconds');
	}
	return value;
}

export function residueClasses(options: CliOptions): readonly ResidueClass[] {
	const requested = options.class ?? [];
	if (requested.length === 0) return RESIDUE_CLASSES;

	const unknown = requested.filter(candidate => !isResidueClass(candidate));
	if (unknown.length > 0) {
		throw new RuxError(`--class expects one of: ${RESIDUE_CLASSES.join(', ')}`);
	}
	return requested.filter(isResidueClass);
}

/**
 * Resolves the language once per invocation.
 *
 * An explicit --lang wins, then the stored preference, then the environment.
 * Nothing else in the program reads the locale, so there is a single place
 * where that order is decided.
 */
export async function startSession(options: CliOptions): Promise<Session> {
	const requested = options.lang;
	if (requested !== undefined && !isLocale(requested)) {
		throw new RuxError(`--lang expects one of: ${LOCALES.join(', ')}`);
	}

	const locale: Locale =
		requested !== undefined && isLocale(requested) ? requested : createPreferenceStore().getLocale();
	const i18n = await initI18n(locale);
	return {t: createTranslator(i18n), locale};
}
