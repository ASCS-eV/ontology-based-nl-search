import eslintConfigPrettier from 'eslint-config-prettier'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '.next/',
      'out/',
      'node_modules/',
      'coverage/',
      'submodules/',
      'public/',
      '*.config.js',
      '*.config.ts',
      'next-env.d.ts',
    ],
  },

  // Base TypeScript configuration
  ...tseslint.configs.recommended,

  // Application source files
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooksPlugin,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      // Next.js rules (subset of core-web-vitals)
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // React hooks
      ...reactHooksPlugin.configs.recommended.rules,

      // Import sorting (replaces prettier-plugin-organize-imports)
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // TypeScript strict rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', args: 'none' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // General quality
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
    },
  },

  // Test files — relaxed rules
  {
    files: ['**/__tests__/**/*', '**/*.test.*', 'e2e/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Scripts — relaxed
  {
    files: ['scripts/**/*'],
    rules: {
      'no-console': 'off',
    },
  },

  // Prettier must be last (disables formatting-related rules)
  eslintConfigPrettier
)
