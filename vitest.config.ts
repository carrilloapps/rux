import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

export default defineConfig({
	resolve: {
		// Ordered, because Vite takes the first alias that matches and '@' would
		// otherwise swallow every '@tests/...' specifier. The array form is what
		// makes the order meaningful; an object would leave it to key iteration.
		alias: [
			{find: '@tests', replacement: fileURLToPath(new URL('./tests', import.meta.url))},
			{find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url))},
		],
	},
	test: {
		include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
		environment: 'node',
		// Rendered frames are asserted as plain text, so colour cannot be left to
		// whatever the surrounding shell sets. CI exports FORCE_COLOR=1 to keep
		// tool output readable, which made Ink interleave escape codes through
		// every frame and turned passing assertions into failures there only.
		env: {FORCE_COLOR: '0'},
		// The PowerShell transport is tested against real PowerShell rather than a
		// mock, and starting it on a cold shared runner costs seconds before any
		// script runs. The default 5s budget makes that a flake rather than a
		// failure, which is the worst of both.
		testTimeout: 30_000,
		coverage: {
			provider: 'v8',
			include: ['src/**'],
			exclude: [
				// Type-only modules compile to nothing, and the PowerShell script
				// modules are template text verified by the adapter and script tests.
				'src/application/ports.ts',
				'src/infrastructure/powershell/scripts/**',
				'src/main.tsx',
			],
			reporter: ['text-summary', 'lcov'],
			// Statements, functions and lines are held at complete coverage.
			// Branches stop short of 100 because the remainder are defensive
			// fallbacks for states the types already rule out, such as a null
			// stdout inside a rendered component. Forcing them would mean
			// asserting against a mock rather than against behaviour.
			thresholds: {statements: 100, functions: 100, lines: 100, branches: 90},
		},
	},
});
