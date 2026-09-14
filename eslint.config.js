import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
	{ignores: ['dist/**', 'build/**', 'coverage/**', 'node_modules/**', '*.config.ts', '*.config.js']},
	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		languageOptions: {
			globals: {...globals.node},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/consistent-type-imports': ['error', {prefer: 'type-imports'}],
			'@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
			'@typescript-eslint/require-await': 'off',
			'no-console': ['error', {allow: ['log', 'error', 'warn']}],
			eqeqeq: ['error', 'smart'],
		},
	},
	{
		files: ['**/*.tsx'],
		...react.configs.flat.recommended,
		settings: {react: {version: 'detect'}},
		plugins: {react, 'react-hooks': reactHooks},
		rules: {
			...react.configs.flat.recommended.rules,
			...reactHooks.configs.recommended.rules,
			'react/react-in-jsx-scope': 'off',
			'react/prop-types': 'off',
		},
	},
	{
		files: ['tests/**/*.ts'],
		rules: {'@typescript-eslint/no-unsafe-assignment': 'off'},
	},
	{
		// Build scripts are plain ESM JavaScript and sit outside the typed program.
		files: ['scripts/**/*.mjs'],
		extends: [tseslint.configs.disableTypeChecked],
		languageOptions: {globals: {...globals.node}},
	},
	prettier,
);
