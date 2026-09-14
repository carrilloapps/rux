import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {'@': fileURLToPath(new URL('./src', import.meta.url))},
	},
	test: {
		include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
		environment: 'node',
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
