import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .claude/ holds Claude Code workflow scripts. Their bodies run inside a
  // function the workflow runner supplies (they end in a top-level `return`),
  // so they are not valid standalone modules and cannot be parsed here.
  globalIgnores(['dist', '.claude']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Supabase Edge Functions are Deno code, deployed with the Supabase CLI.
    // They are outside this repo's `tsc -b` projects, so no check here can
    // verify a type written for them. They handle untyped external JSON
    // (Socrata rows, column_mapping configs), and typing that by hand without
    // a type-checker would add claims nothing confirms. Revisit if a
    // `deno check` step is ever added.
    files: ['supabase/functions/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
