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
      'packages/authoring-wasm/wasm/',
      'packages/authoring-wasm/.build/',
      'packages/scenario-viewer-wasm/wasm/',
      'packages/scenario-viewer-wasm/.build/',
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

      // Criterion #1: no `process.env` outside the config loader. All env
      // vars are declared in the Zod schema and consumed via getConfig().
      // The logger bootstrap (packages/core/src/logging) reads two env vars
      // directly to break the chicken-and-egg with config parse failures
      // and disables this rule inline.
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'Use getConfig() from @ontology-search/core/config instead of process.env. Declare new env vars in the Zod schema.',
        },
      ],
    },
  },

  // The config loader itself reads process.env — that IS its job.
  {
    files: ['packages/core/src/config/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },

  // Test files — relaxed rules. Tests legitimately set up env-var
  // fixtures (e.g. `process.env.ONTOLOGY_ROOT = tmpDir`); criterion #23
  // governs cleanup discipline, not whether the access is allowed.
  {
    files: ['**/__tests__/**/*', '**/*.test.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', 'e2e/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-restricted-syntax': 'off',
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
