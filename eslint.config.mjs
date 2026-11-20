import eslint from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginN from 'eslint-plugin-n';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['coverage/**', 'dist/**', 'test/migrations/**']
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginN.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- marked stable only from Node.js 22.16, but available without a flag in every 22.x (checked on 22.3.0)
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-deprecated': 'warn',
      'n/prefer-node-protocol': 'error',
      // lint:types already checks that every import resolves
      'n/no-missing-import': 'off'
    }
  },
  {
    files: ['test/**/*.test.ts'],
    ...vitest.configs.recommended
  },
  eslintConfigPrettier
);
