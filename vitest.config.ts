import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Vitest runs the project's pure TypeScript game-logic (types/index.ts helpers,
// reward/stamina/siege math) in Node — no React Native runtime required.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
})
