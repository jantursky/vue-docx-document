import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// The unit suite runs in happy-dom under Node. These tests run Blob output, image loading
// and the preview's pagination in real engines.
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['test/browser/**/*.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
    },
  },
})
