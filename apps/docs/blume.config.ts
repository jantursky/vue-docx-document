import { readFileSync } from 'node:fs'

import { defineConfig } from 'blume'

const pkg = JSON.parse(
  readFileSync(new URL('../../packages/vue-docx-document/package.json', import.meta.url), 'utf8'),
) as {
  version: string
}

export default defineConfig({
  title: 'vue-docx-document',
  description: 'Create Word (.docx) files with Vue 3 components.',
  logo: '/logo.svg',
  github: {
    owner: 'jantursky',
    repo: 'vue-docx-document',
    dir: 'apps/docs',
  },
  navigation: {
    actions: [
      { href: 'https://vue-docx-document.vercel.app', label: 'Demo' },
      { href: 'https://www.npmjs.com/package/vue-docx-document', label: 'npm' },
    ],
  },
  content: {
    root: 'docs',
  },
  theme: {
    accent: { light: '#266df0', dark: '#5b8ff5' },
    mode: 'system',
    fonts: {
      display: { name: 'Inter Tight', weights: [600] },
      body: { name: 'Inter', weights: [400, 500, 600] },
    },
  },
  variables: {
    version: pkg.version,
  },
  deployment: {
    site: 'https://vue-docx-document-docs.vercel.app',
  },
  // The live previews run the demo app's example files, so the docs and the demo never drift apart.
  examples: {
    source: '../example/src/examples/*Example.vue',
    css: 'examples.css',
  },
})
