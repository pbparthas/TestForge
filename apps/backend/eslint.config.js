import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce explicit return types
      '@typescript-eslint/explicit-function-return-type': 'error',

      // No any
      '@typescript-eslint/no-explicit-any': 'error',

      // Prefer nullish coalescing
      '@typescript-eslint/prefer-nullish-coalescing': 'error',

      // Prefer optional chaining
      '@typescript-eslint/prefer-optional-chain': 'error',

      // No unused vars (error, not warning)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
      }],

      // No floating promises
      '@typescript-eslint/no-floating-promises': 'error',

      // Require await
      '@typescript-eslint/require-await': 'error',

      // No misused promises
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.*'],
  }
);
