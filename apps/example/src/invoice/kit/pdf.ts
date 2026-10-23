import { h } from 'vue'
import { Document, Image, Page, Text, View } from 'vue-pdf-document'

import './pdf-fonts'
import { kitComponent } from './define'
import { PAGE, pageParts } from './layout'
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

const HAIRLINE = '0.5pt solid #e5e7eb'

const KitDocument = kitComponent<KitDocumentProps>(
  'KitDocument',
  { title: String, author: String, subject: String, language: String },
  (p, slots) =>
    h(
      Document,
      { title: p.title, author: p.author, subject: p.subject, language: p.language, creator: 'vue-docx-document demo' },
      () =>
        h(
          Page,
          {
            size: 'A4',
            style: {
              paddingTop: PAGE.margin,
              paddingHorizontal: PAGE.margin,
              paddingBottom: 64,
              fontFamily: 'Roboto',
              fontSize: 9,
              color: '#1f2937',
            },
          },
          slots.default,
        ),
    ),
)

const Columns = kitComponent<ColumnsProps>('Columns', { gap: Number }, (p, slots) =>
  h(View, { style: { flexDirection: 'row', gap: p.gap } }, slots.default),
)

// Padding sits on an inner view, so the outer one keeps the exact share of the row, as a table cell does.
const Column = kitComponent<ColumnProps>('Column', { width: Number, background: String, padding: Number }, (p, slots) =>
  h(View, { style: { flexGrow: p.width, flexShrink: 1, flexBasis: 0, backgroundColor: p.background } }, () =>
    h(View, { style: { padding: p.padding } }, slots.default),
  ),
)

const Line = kitComponent<LineProps>(
  'Line',
  { size: Number, bold: Boolean, caps: Boolean, color: String, align: String, after: Number },
  (p, slots) =>
    h(
      Text,
      {
        style: {
          fontSize: p.size,
          fontWeight: p.bold ? 700 : 400,
          textTransform: p.caps ? 'uppercase' : undefined,
          letterSpacing: p.caps ? 0.6 : undefined,
          color: p.color,
          textAlign: p.align,
          marginBottom: p.after,
        },
      },
      slots.default,
    ),
)

const Spacer = kitComponent<SpacerProps>('Spacer', { height: Number }, (p) => h(View, { style: { height: p.height } }))

const Img = kitComponent<ImgProps>(
  'Img',
  { src: String, alt: String, width: Number, height: Number, align: String },
  (p) =>
    h(Image, {
      src: p.src,
      style: {
        width: p.width,
        height: p.height,
        objectFit: 'contain',
        alignSelf: p.align === 'right' ? 'flex-end' : 'flex-start',
      },
    }),
)

const ItemsTable = kitComponent<ItemsTableProps>(
  'ItemsTable',
  { columns: Array, rows: Array, footer: Array, accent: String, width: Number, align: String },
  (p) => {
    const cells = (row: string[]) =>
      row.map((text, index) =>
        h(
          Text,
          {
            style: {
              flexGrow: p.columns[index]?.width,
              flexShrink: 1,
              flexBasis: 0,
              paddingHorizontal: 6,
              textAlign: p.columns[index]?.align,
            },
          },
          () => text,
        ),
      )
    const row = { flexDirection: 'row', paddingVertical: 5 } as const

    return h(View, { style: { width: p.width, alignSelf: p.align === 'right' ? 'flex-end' : undefined } }, () => [
      // Fixed inside the table's own view, so it repeats at the top of every page the table spans.
      h(View, { fixed: true, style: { ...row, backgroundColor: p.accent, color: '#ffffff', fontWeight: 700 } }, () =>
        cells(p.columns.map((column) => column.header)),
      ),
      ...p.rows.map((values, index) =>
        h(
          View,
          {
            wrap: false,
            style: { ...row, borderBottom: HAIRLINE, backgroundColor: index % 2 === 1 ? '#f9fafb' : undefined },
          },
          () => cells(values),
        ),
      ),
      p.footer &&
        h(View, { wrap: false, style: { ...row, fontWeight: 700, borderTop: '0.75pt solid #6b7280' } }, () =>
          cells(p.footer ?? []),
        ),
    ])
  },
)

const PageFooter = kitComponent<PageFooterProps>('PageFooter', { text: String, pageTemplate: String }, (p) =>
  h(
    View,
    {
      fixed: true,
      style: {
        position: 'absolute',
        bottom: 28,
        left: PAGE.margin,
        right: PAGE.margin,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 6,
        borderTop: HAIRLINE,
        fontSize: 7.5,
        color: '#6b7280',
      },
    },
    () => [
      h(Text, null, () => p.text),
      h(Text, null, {
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          pageParts(p.pageTemplate)
            .map((part) => (typeof part === 'string' ? part : String(part.number === 'page' ? pageNumber : totalPages)))
            .join(''),
      }),
    ],
  ),
)

export const pdfKit: Kit = { KitDocument, Columns, Column, Line, Spacer, Img, ItemsTable, PageFooter }
