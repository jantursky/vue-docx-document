// Fails when the reference pages leave out something the package exports: a component, a prop
// of its props interfaces, a function or a type. It reads the source with regular expressions,
// the way scripts/samples.js reads the docs, so it needs no compiler. Usage:
// node scripts/docs-drift.js (it is part of `bun run check`).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = join(import.meta.dirname, '..')
const lib = 'packages/vue-docx-document/src'
const docs = 'apps/docs/docs/reference'

// Names that are exported or declared on purpose without a place in the reference pages.
// Say why next to each entry.
export const ALLOWED = {
  // `Length` is re-exported from the units module and documented under its own heading.
  names: new Set([]),
}

/** Names exported by `src/index.ts`, split into values (components, functions) and types. */
export function indexExports(source) {
  const values = new Set()
  const types = new Set()
  for (const [, kind, list] of source.matchAll(/export\s+(type\s+)?\{([^}]*)\}/g)) {
    for (const item of list.split(',')) {
      const entry = item.trim()
      if (!entry) continue
      const isType = Boolean(kind) || entry.startsWith('type ')
      const name = entry
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
        .trim()
      ;(isType ? types : values).add(name)
    }
  }
  return { values, types }
}

/** Every exported interface and type alias in a source file, and the members of each interface. */
export function declarations(source) {
  const types = new Set()
  const interfaces = new Map()
  for (const [, name] of source.matchAll(/^export type (\w+)/gm)) types.add(name)
  const header = /^export interface (\w+)(?:<[^>{]*>)?(?:\s+extends\s+([^{]+))?\s*\{/gm
  for (const match of source.matchAll(header)) {
    const [, name, parents] = match
    types.add(name)
    let depth = 1
    let end = match.index + match[0].length
    while (depth > 0 && end < source.length) {
      const char = source[end++]
      if (char === '{') depth++
      else if (char === '}') depth--
    }
    const body = source.slice(match.index + match[0].length, end - 1)
    const members = new Set()
    let level = 0
    for (const line of body.split('\n')) {
      if (level === 0) {
        const member = /^\s*(?:readonly\s+)?(\w+)\??\s*:/.exec(line)
        if (member) members.add(member[1])
      }
      for (const char of line.replace(/\/\/.*$/, '')) {
        if (char === '{') level++
        else if (char === '}') level--
      }
    }
    interfaces.set(name, {
      members,
      parents: parents ? parents.split(',').map((p) => p.trim().replace(/<.*$/, '')) : [],
    })
  }
  return { types, interfaces }
}

/** All members of an interface, including those it inherits from interfaces in the same file. */
export function allMembers(interfaces, name, seen = new Set()) {
  if (seen.has(name) || !interfaces.has(name)) return new Set()
  seen.add(name)
  const { members, parents } = interfaces.get(name)
  const all = new Set(members)
  for (const parent of parents) for (const member of allMembers(interfaces, parent, seen)) all.add(member)
  return all
}

const mentions = (page, name) => new RegExp(`\`[^\`\\n]*\\b${name}\\b[^\`\\n]*\`|^#+ .*\\b${name}\\b`, 'm').test(page)

/** Problems found, as `name (what) -> page` lines, for the given source and page texts. */
export function driftProblems({ index, typesSource, modelSource, pages }) {
  const problems = []
  const { values, types } = indexExports(index)
  const everything = Object.values(pages).join('\n')
  const component = pages['components.mdx']
  for (const name of values) {
    if (ALLOWED.names.has(name)) continue
    if (!mentions(everything, name)) problems.push(`${name} (export) -> not in any reference page`)
  }
  const props = declarations(typesSource)
  const model = declarations(modelSource)
  for (const name of [...props.types, ...model.types]) {
    if (ALLOWED.names.has(name)) continue
    if (!mentions(everything, name)) problems.push(`${name} (type) -> not in any reference page`)
  }
  const missingProps = new Map()
  for (const name of props.interfaces.keys()) {
    if (!name.endsWith('Props') && !['RunStyle', 'ParagraphStyle'].includes(name)) continue
    for (const member of allMembers(props.interfaces, name)) {
      if (ALLOWED.names.has(`${name}.${member}`) || mentions(component, member)) continue
      missingProps.set(member, [...(missingProps.get(member) ?? []), name])
    }
  }
  // A prop shared through `extends` is one gap, so name it once with the interfaces that declare it.
  for (const [member, owners] of missingProps) {
    const own = owners.filter((owner) => props.interfaces.get(owner).members.has(member))
    problems.push(`${member} (prop of ${(own.length > 0 ? own : owners).join(', ')}) -> components.mdx`)
  }
  for (const name of types) {
    if (!mentions(everything, name) && !ALLOWED.names.has(name))
      problems.push(`${name} (exported type) -> not in any reference page`)
  }
  return [...new Set(problems)]
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const read = (path) => readFileSync(join(root, path), 'utf8')
  const pages = Object.fromEntries(
    ['components.mdx', 'types.mdx', 'functions.mdx', 'composables.mdx'].map((file) => [file, read(`${docs}/${file}`)]),
  )
  const problems = driftProblems({
    index: read(`${lib}/index.ts`),
    typesSource: read(`${lib}/components/types.ts`),
    modelSource: read(`${lib}/core/model.ts`),
    pages,
  })
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) {
    console.error(`\n${problems.length} item(s) are missing from the reference pages in ${docs}.`)
    process.exit(1)
  }
  console.log('The reference pages cover the public API.')
}
