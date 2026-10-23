import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const root = (path: string): string => resolve(import.meta.dirname, path)

const pkg = JSON.parse(readFileSync(root('package.json'), 'utf8')) as { dependencies: Record<string, string> }
const external = ['vue', ...Object.keys(pkg.dependencies)]
const isExternal = (id: string): boolean =>
  id.startsWith('node:') || external.some((name) => id === name || id.startsWith(`${name}/`))

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.build.json',
      include: ['src'],
      bundleTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: { index: root('src/index.ts') },
      // ESM only, like Vue's own runtime build.
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
    rollupOptions: {
      external: isExternal,
      output: { chunkFileNames: 'chunks/[name]-[hash].js' },
    },
    sourcemap: true,
    minify: true,
    target: 'es2020',
    emptyOutDir: true,
  },
})
