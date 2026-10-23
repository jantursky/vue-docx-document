// Installs the packed tarball into an empty project, the way a consumer gets it from
// npm, and renders a document from it in plain Node. Run after `bun run build`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const packageDir = resolve(import.meta.dirname, '..')
const dir = mkdtempSync(join(tmpdir(), 'vue-docx-document-pack-'))
const run = (command, args, cwd, env = process.env) =>
  execFileSync(command, args, { cwd, env, encoding: 'utf8', stdio: 'pipe' })

try {
  const [packed] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', dir], packageDir))
  const files = packed.files.map((file) => file.path).sort()
  const allowed =
    /^(dist\/index\.(js|js\.map|d\.ts)|dist\/chunks\/[\w.-]+\.(js|js\.map)|README\.md|CHANGELOG\.md|LICENSE|package\.json)$/
  const unexpected = files.filter((file) => !allowed.test(file))
  if (unexpected.length > 0) throw new Error(`Unexpected files in the tarball: ${unexpected.join(', ')}`)
  console.log(`tarball: ${packed.filename}, ${files.length} files, ${(packed.size / 1024).toFixed(1)} kB`)

  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }))
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', `./${packed.filename}`, 'vue@^3.5.0'], dir)

  writeFileSync(
    join(dir, 'consumer.js'),
    `import { h } from 'vue'
import { Document, Paragraph, Section, renderToBuffer } from 'vue-docx-document'

const Hello = { render: () => h(Document, { title: 'Pack test' }, () => h(Section, () => h(Paragraph, () => 'Hello'))) }
const bytes = await renderToBuffer(Hello)
if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Not a zip file')
const names = new TextDecoder('latin1').decode(bytes)
if (!names.includes('word/document.xml')) throw new Error('The file has no word/document.xml')
console.log('rendered ' + bytes.length + ' bytes from the installed package')
`,
  )
  console.log(run('node', ['consumer.js'], dir).trim())

  // Vue's production build drops a failing component quietly unless the error is caught.
  writeFileSync(
    join(dir, 'consumer-error.js'),
    `import { h } from 'vue'
import { Document, Paragraph, Section, renderToBuffer } from 'vue-docx-document'

const Broken = { render: () => h(Paragraph, () => null.name) }
const Doc = { render: () => h(Document, () => h(Section, () => [h(Paragraph, () => 'Kept'), h(Broken)])) }
const error = await renderToBuffer(Doc).then(() => null, (caught) => caught)
if (!(error instanceof TypeError)) throw new Error('A render error did not reject: ' + String(error))
console.log('render errors reject in production')
`,
  )
  console.log(run('node', ['consumer-error.js'], dir, { ...process.env, NODE_ENV: 'production' }).trim())

  // CommonJS consumers load the ESM build through Node's require(esm).
  writeFileSync(
    join(dir, 'consumer.cjs'),
    `const { renderToBuffer, Document } = require('vue-docx-document')
if (typeof renderToBuffer !== 'function' || !Document) throw new Error('require() returned no exports')
console.log('require() works')
`,
  )
  console.log(run('node', ['consumer.cjs'], dir).trim())
} finally {
  rmSync(dir, { recursive: true, force: true })
}
