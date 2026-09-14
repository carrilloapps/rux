/**
 * Headless render harness.
 *
 * Drives the real interface against a fake TTY so a frame can be inspected in
 * CI or from a non-interactive shell. Not part of the test suite.
 *
 * Usage:
 *   npm run preview -- <view> <locale> <waitMs>
 *   npm run preview -- hardware es-VE 5000
 */
import {EventEmitter} from 'node:events';
import {Writable} from 'node:stream';
import React from 'react';
import {render} from 'ink';
import {createApplication} from '@/infrastructure/container';
import {createTranslator, initI18n, type Locale} from '@/i18n/translator';
import {createEphemeralPreferenceStore} from '@/presentation/config';
import {App} from '@/presentation/tui/App';
import type {View} from '@/presentation/tui/view';

const view = (process.argv[2] ?? 'startup') as View;
const locale = (process.argv[3] ?? 'en-US') as Locale;
const waitMs = Number(process.argv[4] ?? 20000);

let buffer = '';
const stdout = new Writable({
	write(chunk, _encoding, callback) {
		buffer += String(chunk);
		callback();
	},
}) as unknown as NodeJS.WriteStream;
Object.assign(stdout, {columns: 120, rows: 36, isTTY: true});

const stdin = new EventEmitter() as unknown as NodeJS.ReadStream;
Object.assign(stdin, {
	isTTY: true,
	setRawMode() {},
	setEncoding() {},
	resume() {},
	pause() {},
	read: () => null,
	ref() {},
	unref() {},
});

const i18n = await initI18n(locale);

const app = render(
	React.createElement(App, {
		useCases: createApplication(),
		t: createTranslator(i18n),
		locale,
		onLocaleChange: () => {},
		preferences: createEphemeralPreferenceStore(locale),
		initialView: view,
		includeTasks: false,
		deep: false,
		readOnly: true,
		refreshIntervalMs: 0,
	}),
	{stdout, stdin, exitOnCtrlC: false, patchConsole: false},
);

setTimeout(() => {
	app.unmount();
	// Ink rewrites the screen on every update; keep only the last frame.
	const clearScreen = String.fromCharCode(27) + '[2J';
	const frames = buffer.split(clearScreen);
	process.stdout.write(frames[frames.length - 1] ?? '');
	process.exit(0);
}, waitMs);
