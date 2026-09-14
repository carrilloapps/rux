import {beforeEach, describe, expect, it, vi} from 'vitest';

const store = new Map<string, unknown>();

vi.mock('conf', () => ({
	default: class FakeConf {
		readonly path = 'C:\\Users\\tester\\AppData\\Roaming\\rux\\preferences.json';

		get(key: string): unknown {
			return store.get(key);
		}

		set(key: string, value: unknown): void {
			store.set(key, value);
		}
	},
}));

const {createEphemeralPreferenceStore, createPreferenceStore} = await import('@/presentation/config');

beforeEach(() => {
	store.clear();
	vi.unstubAllEnvs();
});

describe('persisted preferences', () => {
	it('falls back to the environment when nothing is stored', () => {
		vi.stubEnv('RUX_LOCALE', 'es-VE');
		expect(createPreferenceStore().getLocale()).toBe('es-VE');
	});

	it('returns a stored locale', () => {
		const preferences = createPreferenceStore();
		preferences.setLocale('es-VE');
		expect(preferences.getLocale()).toBe('es-VE');
	});

	it('ignores a stored value that is no longer a supported locale', () => {
		vi.stubEnv('RUX_LOCALE', 'en-US');
		store.set('locale', 'fr-FR');
		expect(createPreferenceStore().getLocale()).toBe('en-US');
	});

	it('exposes where the file lives, so the user can find it', () => {
		expect(createPreferenceStore().path).toContain('preferences.json');
	});
});

describe('ephemeral preferences', () => {
	it('starts from the environment when given no initial locale', () => {
		vi.stubEnv('RUX_LOCALE', 'es-VE');
		expect(createEphemeralPreferenceStore().getLocale()).toBe('es-VE');
	});

	it('honours an explicit initial locale', () => {
		expect(createEphemeralPreferenceStore('es-VE').getLocale()).toBe('es-VE');
	});

	it('remembers a change for the lifetime of the process only', () => {
		const preferences = createEphemeralPreferenceStore('en-US');
		preferences.setLocale('es-VE');

		expect(preferences.getLocale()).toBe('es-VE');
		expect(preferences.path).toBe('(memory)');
	});
});
