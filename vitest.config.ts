import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {'@': fileURLToPath(new URL('./src', import.meta.url))},
	},
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
		coverage: {
			provider: 'v8',
			include: ['src/domain/**', 'src/application/**', 'src/i18n/**', 'src/shared/**'],
			reporter: ['text-summary', 'lcov'],
			thresholds: {lines: 70, functions: 70, branches: 70, statements: 70},
		},
	},
});
