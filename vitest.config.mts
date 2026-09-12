import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['{lib,components,app}/**/*.test.{ts,tsx}'],
    env: { TZ: 'Asia/Tokyo' },
    coverage: {
      provider: 'v8',
      include: ['lib/format.ts', 'lib/utils.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
})
