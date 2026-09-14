import {defineConfig} from 'tsup';

export default defineConfig({
	entry: {main: 'src/main.tsx'},
	format: ['esm'],
	target: 'node18',
	platform: 'node',
	outDir: 'dist',
	clean: true,
	splitting: false,
	sourcemap: false,
	dts: false,
	minify: false,
	banner: {js: '#!/usr/bin/env node'},
	// Ink and React resolve at runtime from node_modules; bundling React breaks hooks identity.
	external: ['react', 'ink', 'ink-text-input', 'systeminformation'],
});
