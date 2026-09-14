import {readFileSync} from 'node:fs';
import {defineConfig} from 'tsup';

const {version} = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
	version: string;
};

export default defineConfig({
	entry: {main: 'src/main.tsx'},
	format: ['esm'],
	target: 'node20',
	platform: 'node',
	outDir: 'dist',
	clean: true,
	splitting: false,
	sourcemap: false,
	dts: false,
	minify: false,
	banner: {js: '#!/usr/bin/env node'},
	// The version is injected rather than imported, so no source file carries a
	// literal version string that could drift from the release tag.
	define: {__RUX_VERSION__: JSON.stringify(version)},
	// Ink and React resolve at runtime from node_modules; bundling React breaks
	// hook identity, and systeminformation loads platform helpers lazily.
	external: ['react', 'ink', 'systeminformation'],
});
