#!/usr/bin/env node
/**
 * Stages the Windows distribution: an embedded Node runtime, the bundled
 * application and a launcher.
 *
 * Why not a single packed executable: rux renders with Ink, whose layout engine
 * is a WebAssembly module loaded through top-level await. That makes the
 * dependency graph ESM-only, and every single-file packer for Node still loads
 * its entry point as CommonJS. Shipping the real Node runtime beside the bundle
 * is the honest alternative: the result is self-contained, needs nothing
 * installed, and runs the exact code that was tested.
 *
 * Usage:
 *   node scripts/package-windows.mjs [--node-exe <path>] [--out <dir>]
 */
import {chmod, copyFile, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');

function parseArguments(argv) {
	const options = {nodeExe: process.execPath, out: path.join(ROOT, 'build')};
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === '--node-exe') options.nodeExe = argv[++index];
		else if (argv[index] === '--out') options.out = argv[++index];
		else throw new Error(`Unknown argument: ${argv[index]}`);
	}
	return options;
}

const LAUNCHER_CMD = ['@echo off', 'setlocal', '"%~dp0node.exe" "%~dp0rux.mjs" %*', 'endlocal', ''].join(
	'\r\n',
);

const LAUNCHER_PS1 = [
	'#!/usr/bin/env pwsh',
	'# Launcher for PowerShell hosts that do not run .cmd shims transparently.',
	'& "$PSScriptRoot\\node.exe" "$PSScriptRoot\\rux.mjs" @args',
	'exit $LASTEXITCODE',
	'',
].join('\r\n');

async function sha256(file) {
	const hash = createHash('sha256');
	hash.update(await readFile(file));
	return hash.digest('hex');
}

async function main() {
	const options = parseArguments(process.argv.slice(2));
	const stage = path.join(options.out, 'stage');

	const {version} = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
	const bundle = path.join(ROOT, 'dist', 'main.js');

	await rm(stage, {recursive: true, force: true});
	await mkdir(stage, {recursive: true});

	await copyFile(bundle, path.join(stage, 'rux.mjs'));
	await copyFile(options.nodeExe, path.join(stage, 'node.exe'));
	await copyFile(path.join(ROOT, 'README.md'), path.join(stage, 'README.md'));
	await copyFile(path.join(ROOT, 'LICENSE'), path.join(stage, 'LICENSE'));
	await writeFile(path.join(stage, 'rux.cmd'), LAUNCHER_CMD, 'utf8');
	await writeFile(path.join(stage, 'rux.ps1'), LAUNCHER_PS1, 'utf8');
	await chmod(path.join(stage, 'node.exe'), 0o755);

	// A staged build that cannot report its own version is not shippable.
	const reported = execFileSync(path.join(stage, 'node.exe'), [path.join(stage, 'rux.mjs'), '--version'], {
		encoding: 'utf8',
	}).trim();
	if (reported !== version) {
		throw new Error(`Staged build reports ${reported}, expected ${version}`);
	}

	const manifest = {
		name: 'rux',
		version,
		platform: 'win32',
		architecture: process.arch,
		nodeVersion: process.versions.node,
		builtAt: new Date().toISOString(),
	};
	await writeFile(path.join(stage, 'build-info.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

	const checksums = [];
	for (const name of ['node.exe', 'rux.mjs', 'rux.cmd', 'rux.ps1']) {
		checksums.push(`${await sha256(path.join(stage, name))}  ${name}`);
	}
	await writeFile(path.join(stage, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`, 'utf8');

	process.stdout.write(`Staged rux ${version} for Windows in ${stage}\n`);
	process.stdout.write(`Node runtime: ${process.versions.node}\n`);
}

main().catch(error => {
	process.stderr.write(`package-windows: ${error.message}\n`);
	process.exit(1);
});
