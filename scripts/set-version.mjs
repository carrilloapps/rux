#!/usr/bin/env node
/**
 * Writes a version into package.json, validating it as semantic versioning
 * first.
 *
 * CI calls this with the published release tag so the tag is the only place a
 * version is ever authored. Everything downstream -- the npm package, the
 * bundled `--version` output, the installer and the release assets -- reads
 * from package.json, so they cannot drift apart.
 *
 * Usage:
 *   node scripts/set-version.mjs v1.2.3
 *   node scripts/set-version.mjs 1.2.3-beta.1
 */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST = path.join(ROOT, 'package.json');

/** Official semantic versioning pattern, from semver.org. */
const SEMVER =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function normalize(input) {
	const version = input.trim().replace(/^v/, '');
	if (!SEMVER.test(version)) {
		throw new Error(`"${input}" is not a valid semantic version`);
	}
	return version;
}

async function main() {
	const [input] = process.argv.slice(2);
	if (!input) {
		throw new Error('A version is required, for example: node scripts/set-version.mjs v0.0.1');
	}

	const version = normalize(input);
	const raw = await readFile(MANIFEST, 'utf8');
	const manifest = JSON.parse(raw);

	if (manifest.version === version) {
		process.stdout.write(`package.json is already at ${version}\n`);
		return;
	}

	const previous = manifest.version;
	manifest.version = version;

	// Rewrite only the version line so the rest of the file, including key
	// order and formatting, stays byte-identical to what Prettier produced.
	const updated = raw.replace(/("version"\s*:\s*)"[^"]*"/, (_match, prefix) => `${prefix}"${version}"`);

	if (!updated.includes(`"version": "${version}"`)) {
		throw new Error('Could not locate the version field in package.json');
	}

	await writeFile(MANIFEST, updated, 'utf8');
	process.stdout.write(`package.json ${previous} -> ${version}\n`);
}

main().catch(error => {
	process.stderr.write(`set-version: ${error.message}\n`);
	process.exit(1);
});
