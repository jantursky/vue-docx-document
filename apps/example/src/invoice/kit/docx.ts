import { cloneVNode, Comment, Fragment, h, type VNode } from 'vue'
import {
  Document,
  Footer,
  Image,
  PageNumber,
  Paragraph,
  Section,
  Tab,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'vue-docx-document'

import { kitComponent } from './define'
import { CONTENT_WIDTH, PAGE, pageParts } from './layout'
import type {
  ColumnProps,
  ColumnsProps,
  ImgProps,
  ItemsTableProps,
  Kit,
  KitDocumentProps,
  LineProps,
  PageFooterProps,
  SpacerProps,
} from './types'

// Word wants a region with the language.
const LOCALES: Record<string, string> = { en: 'en-GB', sk: 'sk-SK' }

const HAIRLINE = '#e5e7eb'

const KitDocument = kitComponent<KitDocumentProps>(
  'KitDocument',
  { title: String, author: String, subject: String, language: String },
  (p, slots) =>
    h(
      Document,
      {
        title: p.title,
        creator: p.author,
        subject: p.subject,
        language: LOCALES[p.language] ?? p.language,
        font: 'Arial',
        fontSize: 9,
        color: '#1f2937',
        lineHeight: 1.15,
        spaceAfter: 0,
      },
      () =>
        h(
          Section,
          {
            size: 'A4',
            margin: { top: PAGE.margin, right: PAGE.margin, bottom: 64, left: PAGE.margin, header: 28, footer: 28 },
          },
          slots.default,
        ),
    ),
)

/** Looks through fragments (`v-for`, `v-if`) to the elements a slot really holds. */
const flatten = (nodes: VNode[]): VNode[] =>
  nodes.flatMap((node) =>
    node.type === Fragment ? flatten(node.children as VNode[]) : node.type === Comment ? [] : [node],
  )

// A row of columns is a table without borders: Word has no flexbox. The table needs every
// column width up front, so `Columns` reads the `width` of its `Column` children and hands
// each its size in points.
const Columns = kitComponent<ColumnsProps>('Columns', { gap: Number }, (p, slots) => {
  const columns = flatten(slots.default?.() ?? [])
  const gap = p.gap ?? 0
  const shares = columns.map((column) => Number(column.props?.width))
  const total = shares.reduce((sum, share) => sum + share, 0)
  const available = CONTENT_WIDTH - gap * (columns.length - 1)
  const sizes = shares.map((share) => (available * share) / total)

  const cells = columns.flatMap((column, index) => [
    ...(index > 0 && gap > 0 ? [h(TableCell, { width: gap }, () => h(Paragraph))] : []),
    cloneVNode(column, { cellWidth: sizes[index] }),
  ])
  const columnWidths = sizes.flatMap((size, index) => (index > 0 && gap > 0 ? [gap, size] : [size]))

  return h(Table, { columnWidths, width: CONTENT_WIDTH, layout: 'fixed', borders: 'none', cellPadding: 0 }, () =>
    h(TableRow, { cantSplit: true }, () => cells),
  )
})

const Column = kitComponent<ColumnProps>(
  'Column',
  { width: Number, background: String, padding: Number, cellWidth: Number },
  (p, slots) => {
    // `cellWidth` is set by `Columns`; it isn't part of the kit's public props.
    const { cellWidth } = p as ColumnProps & { cellWidth?: number }
    const content = slots.default?.() ?? []
    return h(
      TableCell,
      { width: cellWidth, background: p.background, padding: p.padding },
      // A cell must hold a paragraph, even when a column is only there to take up room.
      () => (content.length > 0 ? content : h(Paragraph)),
    )
  },
)

const Line = kitComponent<LineProps>(
  'Line',
  { size: Number, bold: Boolean, caps: Boolean, color: String, align: String, after: Number },
  (p, slots) =>
    h(
      Paragraph,
      {
        size: p.size,
        bold: p.bold,
        allCaps: p.caps,
        characterSpacing: p.caps ? 0.6 : undefined,
        color: p.color,
        align: p.align,
        spaceAfter: p.after,
      },
      slots.default,
    ),
)

const Spacer = kitComponent<SpacerProps>('Spacer', { height: Number }, (p) =>
  h(Paragraph, { size: 1, spaceAfter: Math.max(p.height - 1, 0) }),
)

const Img = kitComponent<ImgProps>(
  'Img',
  { src: String, alt: String, width: Number, height: Number, align: String },
  (p) => h(Image, { src: p.src, alt: p.alt, width: p.width, height: p.height, align: p.align }),
)

const ItemsTable = kitComponent<ItemsTableProps>(
  'ItemsTable',
  { columns: Array, rows: Array, footer: Array, accent: String, width: Number, align: String },
  (p) => {
    const width = p.width ?? CONTENT_WIDTH
    const total = p.columns.reduce((sum, column) => sum + column.width, 0)
    const cell = (text: string | undefined, index: number, borders?: object) =>
      h(TableCell, { borders: borders as never }, () => h(Paragraph, { align: p.columns[index]?.align }, () => text))

    return h(
      Table,
      {
        columnWidths: p.columns.map((column) => (width * column.width) / total),
        width,
        layout: 'fixed',
        align: p.align,
        borders: 'none',
        cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
      },
      () => [
        h(TableRow, { header: true, cantSplit: true, background: p.accent, color: '#ffffff', bold: true }, () =>
          p.columns.map((column, index) => cell(column.header, index)),
        ),
        ...p.rows.map((row, rowIndex) =>
          h(TableRow, { cantSplit: true, background: rowIndex % 2 === 1 ? '#f9fafb' : undefined }, () =>
            row.map((text, index) => cell(text, index, { bottom: { style: 'single', size: 0.5, color: HAIRLINE } })),
          ),
        ),
        p.footer &&
          h(TableRow, { cantSplit: true, bold: true }, () =>
            p.footer?.map((text, index) =>
              cell(text, index, { top: { style: 'single', size: 0.75, color: '#6b7280' } }),
            ),
          ),
      ],
    )
  },
)

const PageFooter = kitComponent<PageFooterProps>('PageFooter', { text: String, pageTemplate: String }, (p) =>
  h(Footer, null, () =>
    h(
      Paragraph,
      {
        size: 7.5,
        color: '#6b7280',
        border: { top: { style: 'single', size: 0.5, color: HAIRLINE, space: 6 } },
        tabStops: [{ position: CONTENT_WIDTH, type: 'right' }],
      },
      () => [
        h(TextRun, { text: p.text }),
        h(Tab),
        ...pageParts(p.pageTemplate).map((part) =>
          typeof part === 'string'
            ? h(TextRun, { text: part })
            : h(PageNumber, { type: part.number === 'page' ? 'current' : 'total' }),
        ),
      ],
    ),
  ),
)

export const docxKit: Kit = { KitDocument, Columns, Column, Line, Spacer, Img, ItemsTable, PageFooter }
