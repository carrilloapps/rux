import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
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
	banner: {
		// Several runtime dependencies are CommonJS. Bundling them into an ESM
		// output leaves esbuild calling require(), which does not exist in a
		// module scope, so it is created here from the module URL.
		js: [
			'#!/usr/bin/env node',
			"import {createRequire as __ruxCreateRequire} from 'node:module';",
			'const require = __ruxCreateRequire(import.meta.url);',
		].join('\n'),
	},
	// The version is injected rather than imported, so no source file carries a
	// literal version string that could drift from the release tag.
	define: {__RUX_VERSION__: JSON.stringify(version)},
	// Everything is bundled so the standalone distribution runs with no
	// node_modules beside it. ESM output makes this possible: Ink loads its
	// layout engine through top-level await, which only an ESM bundle carries.
	noExternal: [/.*/],
	esbuildOptions(options) {
		// Ink statically imports this from its development tooling module, so an
		// unresolved reference breaks the bundle at load time even though the code
		// path only runs when DEV is set. The stub keeps the output self-contained.
		options.alias = {
			...options.alias,
			'react-devtools-core': fileURLToPath(new URL('./scripts/devtools-stub.mjs', import.meta.url)),
		};
	},
});
