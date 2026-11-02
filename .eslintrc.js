// Minimal lint setup: TypeScript + React hooks rules, using the plugins already in devDependencies.
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: { react: { version: 'detect' } },
  env: { es2022: true, node: true },
  ignorePatterns: ['node_modules/', 'supabase/functions/', '.expo/', 'dist/', 'android/', 'ios/'],
  rules: {
    'react/react-in-jsx-scope': 'off', // React 17+ JSX transform
    'react/prop-types': 'off', // TypeScript checks props
    'react/no-unescaped-entities': 'off', // web-only concern; RN <Text> renders quotes as-is
    'no-empty': ['error', { allowEmptyCatch: true }], // best-effort fallbacks (e.g. GPS) use empty catch on purpose
    '@typescript-eslint/no-var-requires': 'off', // RN loads assets with require()
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn', // shortcut: 43 existing uses, tighten to error once typed
  },
}
