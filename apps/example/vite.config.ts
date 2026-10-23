import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const lib = (path: string) => fileURLToPath(new URL(`../../packages/vue-docx-document/${path}`, import.meta.url))
const { version } = JSON.parse(readFileSync(lib('package.json'), 'utf8')) as { version: string }

// The dev server reads the library's source so edits hot-reload across packages.
// Builds resolve `vue-docx-document` through node_modules, i.e. the library's real dist output.
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // The PDF engine (layout, fontkit, pdfkit) is about 1 MB minified and loads with the generator.
  build: { chunkSizeWarningLimit: 1200 },
  define: {
    __VUE_DOCX_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: command === 'serve' ? [{ find: /^vue-docx-document$/, replacement: lib('src/index.ts') }] : [],
  },
}))
