#!/usr/bin/env node
/**
 * Removes every generated directory.
 *
 * `tsup` clears its own output, but the staged Windows distribution, the
 * installer output and the coverage report accumulate across runs, and a stale
 * `build/stage` is the kind of thing that makes a packaging problem look fixed
 * when it is not.
 *
 * Usage:
 *   node scripts/clean.mjs
 */
import {rm} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const GENERATED = ['dist', 'build', 'coverage'];

await Promise.all(
	GENERATED.map(async directory => {
		await rm(path.join(ROOT, directory), {recursive: true, force: true});
	}),
);

process.stdout.write(`Removed ${GENERATED.join(', ')}\n`);
