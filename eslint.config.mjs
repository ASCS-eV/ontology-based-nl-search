import eslintConfigPrettier from 'eslint-config-prettier'
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
      'dist/',
      '**/dist/**',
      '**/.vitepress/cache/**',
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
      'next-env.d.ts',
      '**/routeTree.gen.ts',
    ],
  },

  // Base TypeScript configuration
  ...tseslint.configs.recommended,

  // All source files
  {
    files: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      // Import sorting
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
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Prettier must be last (disables formatting-related rules)
  eslintConfigPrettier
)
