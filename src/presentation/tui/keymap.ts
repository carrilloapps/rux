import type {Translator} from '@/i18n/translator';
import type {View} from '@/presentation/tui/view';

export interface KeyBinding {
	readonly keys: string;
	readonly description: string;
}

const SHARED_BEFORE: ReadonlyArray<readonly [string, string]> = [
	['tab', 'keys.switchView'],
	['up down / j k', 'keys.move'],
	['g / G', 'keys.firstLast'],
	['/', 'keys.search'],
];

const SHARED_AFTER: ReadonlyArray<readonly [string, string]> = [
	['r', 'keys.rescan'],
	['l', 'keys.language'],
	['?', 'keys.help'],
	['q', 'keys.quit'],
];

const PER_VIEW: Readonly<Record<View, ReadonlyArray<readonly [string, string]>>> = Object.freeze({
	startup: [
		['f / F', 'keys.filter'],
		['s', 'keys.sort'],
		['space', 'keys.toggleEntry'],
		['d', 'keys.removeEntry'],
		['t', 'keys.includeTasks'],
	],
	residue: [
		['space', 'keys.select'],
		['a', 'keys.selectSafe'],
		['A', 'keys.selectAll'],
		['n', 'keys.selectNone'],
		['x / enter', 'keys.apply'],
		['D', 'keys.deepScan'],
	],
	junk: [
		['space', 'keys.select'],
		['a', 'keys.selectSafe'],
		['A', 'keys.selectAll'],
		['n', 'keys.selectNone'],
		['x / enter', 'keys.apply'],
	],
	hardware: [],
});

/** The help overlay contents for one view, already translated. */
export function keyBindingsFor(view: View, t: Translator): readonly KeyBinding[] {
	return [...SHARED_BEFORE, ...PER_VIEW[view], ...SHARED_AFTER].map(([keys, key]) => ({
		keys,
		description: t(key),
	}));
}
