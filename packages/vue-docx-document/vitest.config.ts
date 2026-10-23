import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    exclude: ['test/browser/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/index.ts', 'src/components/types.ts', 'src/core/model.ts'],
      reporter: ['text-summary', 'text', 'html', 'lcov'],
      thresholds: { statements: 92, branches: 78, functions: 95, lines: 95 },
    },
  },
})
