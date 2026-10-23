import { defineComponent, h, type DefineComponent, type SlotsType, type VNode } from 'vue'

import { TYPES } from '../core/nodes'
import type {
  BookmarkProps,
  DocumentProps,
  HeaderFooterProps,
  ImageProps,
  LinkProps,
  ListItemProps,
  ListProps,
  PageNumberProps,
  ParagraphProps,
  SectionProps,
  TableCellProps,
  TableOfContentsProps,
  TableProps,
  TableRowProps,
  TextRunProps,
} from './types'

interface DefaultSlot {
  default?: () => VNode[]
}

/** Boolean run props a template may write as bare attributes (`<TextRun bold>`). */
const RUN_FLAGS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'doubleStrike',
  'superscript',
  'subscript',
  'allCaps',
  'smallCaps',
] as const
const PARAGRAPH_FLAGS = [...RUN_FLAGS, 'keepNext', 'keepLines', 'pageBreakBefore'] as const

// Each primitive renders an element of its type. Props go through as attributes, except the
// flags it declares, which Vue casts so `<TextRun bold>` means `bold: true`.
const primitive = <Props extends object>(name: string, type: string, flags: readonly string[] = []) =>
  defineComponent(
    (props: Record<string, unknown>, { attrs, slots }) =>
      () => {
        const set = Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined))
        return h(type, { ...attrs, ...set }, slots.default?.())
      },
    {
      name,
      inheritAttrs: false,
      // Boolean first, so a bare attribute is true; `underline` also takes a style name.
      props: Object.fromEntries(flags.map((flag) => [flag, { type: [Boolean, String], default: undefined }])) as never,
      slots: Object as SlotsType<DefaultSlot>,
    },
  ) as unknown as DefineComponent<Props>

export const Document = primitive<DocumentProps>('Document', TYPES.document)
export const Section = primitive<SectionProps>('Section', TYPES.section)
export const Header = primitive<HeaderFooterProps>('Header', TYPES.header)
export const Footer = primitive<HeaderFooterProps>('Footer', TYPES.footer)
export const Paragraph = primitive<ParagraphProps>('Paragraph', TYPES.paragraph, PARAGRAPH_FLAGS)
export const TextRun = primitive<TextRunProps>('TextRun', TYPES.run, RUN_FLAGS)
export const Link = primitive<LinkProps>('Link', TYPES.link, RUN_FLAGS)
export const Bookmark = primitive<BookmarkProps>('Bookmark', TYPES.bookmark)
export const Break = primitive<Record<string, never>>('Break', TYPES.break)
export const Tab = primitive<Record<string, never>>('Tab', TYPES.tab)
export const PageBreak = primitive<Record<string, never>>('PageBreak', TYPES.pageBreak)
export const ColumnBreak = primitive<Record<string, never>>('ColumnBreak', TYPES.columnBreak)
export const PageNumber = primitive<PageNumberProps>('PageNumber', TYPES.pageNumber, RUN_FLAGS)
export const Footnote = primitive<Record<string, never>>('Footnote', TYPES.footnote)
export const Image = primitive<ImageProps>('Image', TYPES.image)
export const Table = primitive<TableProps>('Table', TYPES.table, RUN_FLAGS)
export const TableRow = primitive<TableRowProps>('TableRow', TYPES.row, [...RUN_FLAGS, 'header', 'cantSplit'])
export const TableCell = primitive<TableCellProps>('TableCell', TYPES.cell, RUN_FLAGS)
export const List = primitive<ListProps>('List', TYPES.list, [...RUN_FLAGS, 'ordered'])
export const ListItem = primitive<ListItemProps>('ListItem', TYPES.listItem, PARAGRAPH_FLAGS)
export const TableOfContents = primitive<TableOfContentsProps>('TableOfContents', TYPES.toc, ['hyperlinks'])
