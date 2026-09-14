#!/usr/bin/env node
/**
 * Renders assets/icon.svg into the raster formats the project needs.
 *
 * The SVG is the only hand-authored artwork; everything else is generated, so
 * the icon can never drift between the installer, the README and the
 * repository. Output lands in assets/ and is committed, because the release
 * workflow must not depend on a rasteriser being present.
 *
 * Usage:
 *   node scripts/build-icons.mjs
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const SOURCE = path.join(ASSETS, 'icon.svg');

/** Sizes Windows Explorer and the installer actually ask for. */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** Sizes used by the README and by anything embedding the mark. */
const PNG_SIZES = [128, 256, 512];

async function renderPng(svg, size) {
	return sharp(svg, {density: 384})
		.resize(size, size, {fit: 'contain'})
		.png({compressionLevel: 9})
		.toBuffer();
}

async function main() {
	const svg = await readFile(SOURCE);
	await mkdir(ASSETS, {recursive: true});

	for (const size of PNG_SIZES) {
		const target = path.join(ASSETS, `icon-${size}.png`);
		await writeFile(target, await renderPng(svg, size));
		process.stdout.write(`assets/icon-${size}.png\n`);
	}

	// png-to-ico takes one buffer per frame and packs them into a single icon.
	const frames = await Promise.all(ICO_SIZES.map(size => renderPng(svg, size)));
	await writeFile(path.join(ASSETS, 'icon.ico'), await pngToIco(frames));
	process.stdout.write(`assets/icon.ico (${ICO_SIZES.join(', ')})\n`);
}

main().catch(error => {
	process.stderr.write(`build-icons: ${error.message}\n`);
	process.exit(1);
});
