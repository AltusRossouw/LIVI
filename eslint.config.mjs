// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: ['node_modules', 'dist', 'out', 'build', 'coverage', 'release', 'tmp', 'temp']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx,cjs,mjs,cts,mts}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    },
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: {
      // Let Prettier handle formatting
      ...prettier.rules,

      '@typescript-eslint/no-explicit-any': ['warn', { ignoreRestArgs: true }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none'
        }
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': 'allow-with-description', // require an explanation
          'ts-expect-error': 'allow-with-description'
        }
      ],

      // React modern JSX transform
      'react/react-in-jsx-scope': 'off'
    }
  },

  // 2) Declaration files: allow `any`/unused — modeling external surfaces
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },

  // 3) Plain JS assets: relax TS-specific rules
  {
    files: ['src/renderer/public/**/*.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
)
