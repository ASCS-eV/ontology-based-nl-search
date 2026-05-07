import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export const base = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
  { ignores: ['dist/', 'node_modules/', 'coverage/'] }
)

export const react = tseslint.config(...base, {
  languageOptions: {
    globals: { ...globals.browser },
  },
})
