import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
	{
		ignores: ['coverage/**', 'docs/**', 'examples/**', 'dist/**'],
	},
	{
		files: ['**/*.ts'],
		extends: [js.configs.recommended, ...tsPlugin.configs['flat/recommended'], prettier],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.node,
			},
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
		},
	},
]);
