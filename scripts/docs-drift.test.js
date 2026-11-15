import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allMembers, declarations, driftProblems, indexExports } from './docs-drift.js'

const types = `
export type Align = 'left' | 'right'
export interface RunStyle {
  bold?: boolean
  /** A doc comment: with a colon. */
  color?: string
}
export interface ParagraphStyle {
  align?: Align
}
export interface ParagraphProps extends RunStyle, ParagraphStyle {
  heading?: 1 | 2
  headings?: Partial<
    Record<string, { nested: boolean }>
  >
  onRender?: (info: { blob: Blob }) => void
}
`

test('reads exported types, interfaces and their members', () => {
  const { types: names, interfaces } = declarations(types)
  assert.deepEqual([...names].sort(), ['Align', 'ParagraphProps', 'ParagraphStyle', 'RunStyle'])
  assert.deepEqual([...interfaces.get('RunStyle').members], ['bold', 'color'])
})

test('skips members nested in an object type and reads multi-line members', () => {
  const { interfaces } = declarations(types)
  const members = [...interfaces.get('ParagraphProps').members]
  assert.deepEqual(members, ['heading', 'headings', 'onRender'])
})

test('collects members inherited through extends', () => {
  const { interfaces } = declarations(types)
  assert.deepEqual([...allMembers(interfaces, 'ParagraphProps')].sort(), [
    'align',
    'bold',
    'color',
    'heading',
    'headings',
    'onRender',
  ])
})

test('splits the index into values and types', () => {
  const index = `export { Document, Paragraph } from './a'
export { useDocx, type UseDocxOptions } from './b'
export type { Length }
export type * from './c'`
  const { values, types: typeNames } = indexExports(index)
  assert.deepEqual([...values].sort(), ['Document', 'Paragraph', 'useDocx'])
  assert.deepEqual([...typeNames].sort(), ['Length', 'UseDocxOptions'])
})

const base = {
  index: "export { Paragraph } from './a'\nexport type * from './types'",
  typesSource: types,
  modelSource: 'export interface DocxModel {\n  meta: string\n}',
}
const full = [
  '### Paragraph',
  '`Align` `RunStyle` `ParagraphStyle` `ParagraphProps` `DocxModel`',
  '`bold`, `color`, `align`, `heading`, `headings`, `onRender`',
].join('\n')

test('passes when every component, type and prop is documented', () => {
  assert.deepEqual(driftProblems({ ...base, pages: { 'components.mdx': full } }), [])
})

test('reports a prop missing from the components page by name', () => {
  const page = full.replace('`bold`, ', '')
  const problems = driftProblems({ ...base, pages: { 'components.mdx': page } })
  assert.deepEqual(problems, ['bold (prop of RunStyle) -> components.mdx'])
})

test('reports a component and a type missing from every page', () => {
  const page = full.replace('### Paragraph', '').replace('`DocxModel`', '')
  const problems = driftProblems({ ...base, pages: { 'components.mdx': page, 'types.mdx': '' } })
  assert.ok(problems.includes('Paragraph (export) -> not in any reference page'))
  assert.ok(problems.includes('DocxModel (type) -> not in any reference page'))
})
