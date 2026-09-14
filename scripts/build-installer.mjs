#!/usr/bin/env node
/**
 * Compiles the Inno Setup installer from the staged distribution.
 *
 * The version comes from package.json rather than the command line, so the
 * installer cannot be built at a version the bundle was not built at. CI calls
 * this after `set-version.mjs` has written the release tag into the manifest.
 *
 * Requires Inno Setup 6 and a completed `npm run package:windows`.
 *
 * Usage:
 *   node scripts/build-installer.mjs
 */
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const STAGE = path.join(ROOT, 'build', 'stage');
const SCRIPT = path.join(ROOT, 'installer', 'rux.iss');

/**
 * Where Inno Setup 6 installs, for both a machine-wide and a per-user install.
 * The compiler is not on PATH by default, so the known locations are tried
 * before giving up with an instruction the reader can act on.
 */
const COMPILER_LOCATIONS = [
	path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Inno Setup 6', 'ISCC.exe'),
	path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Inno Setup 6', 'ISCC.exe'),
	path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
];

function fail(message) {
	process.stderr.write(`build-installer: ${message}\n`);
	process.exit(1);
}

if (process.platform !== 'win32') {
	fail('the installer can only be compiled on Windows');
}

if (!existsSync(STAGE)) {
	fail('build\\stage is missing. Run "npm run package:windows" first.');
}

const compiler = COMPILER_LOCATIONS.find(candidate => existsSync(candidate));
if (!compiler) {
	fail('Inno Setup 6 was not found. Install it with "winget install JRSoftware.InnoSetup".');
}

const {version} = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const result = spawnSync(compiler, [`/DAppVersion=${version}`, SCRIPT], {stdio: 'inherit'});

if (result.error) fail(result.error.message);
if (result.status !== 0) fail(`Inno Setup exited with code ${result.status}`);

const installer = path.join(ROOT, 'build', `rux-${version}-setup.exe`);
if (!existsSync(installer)) {
	fail('Inno Setup reported success but produced no installer');
}

process.stdout.write(`Built ${path.relative(ROOT, installer)}\n`);
