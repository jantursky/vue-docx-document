/** Element types the primitives render. Each one becomes a node of the same type in the tree. */
export const TYPES = {
  document: 'DOCUMENT',
  section: 'SECTION',
  header: 'HEADER',
  footer: 'FOOTER',
  paragraph: 'PARAGRAPH',
  run: 'TEXT_RUN',
  link: 'LINK',
  bookmark: 'BOOKMARK',
  break: 'BREAK',
  tab: 'TAB',
  pageBreak: 'PAGE_BREAK',
  columnBreak: 'COLUMN_BREAK',
  pageNumber: 'PAGE_NUMBER',
  footnote: 'FOOTNOTE',
  image: 'IMAGE',
  table: 'TABLE',
  row: 'TABLE_ROW',
  cell: 'TABLE_CELL',
  list: 'LIST',
  listItem: 'LIST_ITEM',
  toc: 'TABLE_OF_CONTENTS',
} as const

export type NodeType = (typeof TYPES)[keyof typeof TYPES]

export const ROOT = 'ROOT'

/**
 * Elements whose children can't be text, so whitespace-only text in them is template formatting.
 * Anywhere else it may be the space between two runs, and resolve decides.
 */
export const STRUCTURAL = new Set<string>([TYPES.document, TYPES.table, TYPES.row, TYPES.list])

export interface DocxElement {
  kind: 'element'
  type: string
  props: Record<string, unknown>
  children: DocxNode[]
  parent: DocxElement | null
}

export interface DocxTextNode {
  kind: 'text'
  value: string
  parent: DocxElement | null
}

export interface DocxCommentNode {
  kind: 'comment'
  value: string
  parent: DocxElement | null
}

export type DocxNode = DocxElement | DocxTextNode | DocxCommentNode

export interface DocxRoot extends DocxElement {
  type: typeof ROOT
  onChange: (() => void) | null
}

export const createElementNode = (type: string): DocxElement => ({
  kind: 'element',
  type,
  props: {},
  children: [],
  parent: null,
})

export const createRoot = (): DocxRoot => ({ ...createElementNode(ROOT), type: ROOT, onChange: null })
