import type { IStylesOptions } from 'docx'

import type {
  Align,
  BorderStyle,
  HeadingLevel,
  HighlightColor,
  ImageType,
  ListFormat,
  PageNumberFormat,
  TabStop,
  UnderlineStyle,
} from '../components/types'

// The resolved document: every length in points, every color `#rrggbb`, every cascade
// applied. The writer turns it into `docx` objects and the preview into HTML.

export interface RunStyleModel {
  bold?: boolean
  italic?: boolean
  underline?: UnderlineStyle
  strike?: boolean
  doubleStrike?: boolean
  color?: string
  highlight?: HighlightColor
  shading?: string
  font?: string
  size?: number
  superscript?: boolean
  subscript?: boolean
  allCaps?: boolean
  smallCaps?: boolean
  characterSpacing?: number
}

export interface BorderModel {
  style: BorderStyle
  size: number
  color: string
  space: number
}

export interface SidesModel<T> {
  top?: T
  right?: T
  bottom?: T
  left?: T
}

export interface ParagraphStyleModel {
  heading?: HeadingLevel
  styleId?: string
  align?: Align
  spaceBefore?: number
  spaceAfter?: number
  lineHeight?: number
  indent?: { left?: number; right?: number; firstLine?: number; hanging?: number }
  keepNext?: boolean
  keepLines?: boolean
  pageBreakBefore?: boolean
  border?: SidesModel<BorderModel>
  background?: string
  tabStops?: (Required<Pick<TabStop, 'type' | 'leader'>> & { position: number })[]
  /** Run formatting of an empty paragraph's mark, which sets the height of its blank line. */
  mark?: RunStyleModel
  /** Set for list items: which list and how deep. */
  list?: { id: string; level: number }
}

export interface TextModel {
  kind: 'text'
  text: string
  style: RunStyleModel
}

export interface BreakModel {
  kind: 'break' | 'tab' | 'pageBreak' | 'columnBreak'
}

export interface PageNumberModel {
  kind: 'pageNumber'
  type: 'current' | 'total' | 'section-total'
  style: RunStyleModel
}

export interface ImageBytes {
  data: Uint8Array
  type: Exclude<ImageType, 'svg'>
}

export interface ImageModel {
  kind: 'image'
  data: Uint8Array
  type: ImageType
  /** Present when `type` is `svg`. */
  fallback?: ImageBytes
  width: number
  height: number
  alt?: string
  title?: string
}

export interface LinkModel {
  kind: 'link'
  href?: string
  anchor?: string
  children: InlineModel[]
}

export interface BookmarkModel {
  kind: 'bookmark'
  id: string
  children: InlineModel[]
}

/** Drawn in Word's FootnoteReference style, a superscript number; run formatting doesn't reach it. */
export interface FootnoteRefModel {
  kind: 'footnote'
  id: number
}

export type InlineModel =
  TextModel | BreakModel | PageNumberModel | ImageModel | LinkModel | BookmarkModel | FootnoteRefModel

export interface ParagraphModel {
  kind: 'paragraph'
  style: ParagraphStyleModel
  children: InlineModel[]
}

export interface CellModel {
  colSpan: number
  rowSpan: number
  background?: string
  verticalAlign: 'top' | 'center' | 'bottom'
  width?: number
  borders?: SidesModel<BorderModel> | 'none'
  padding?: SidesModel<number>
  children: BlockModel[]
}

export interface RowModel {
  header: boolean
  cantSplit: boolean
  height?: number
  cells: CellModel[]
}

export interface TableModel {
  kind: 'table'
  width: { value: number; unit: 'pt' | '%' }
  columnWidths: number[]
  layout: 'fixed' | 'auto'
  align?: 'left' | 'center' | 'right'
  borders: (SidesModel<BorderModel> & { insideH?: BorderModel; insideV?: BorderModel }) | 'none'
  cellPadding?: SidesModel<number>
  rows: RowModel[]
}

export interface TocModel {
  kind: 'toc'
  title?: string
  levels: [number, number]
  hyperlinks: boolean
}

export type BlockModel = ParagraphModel | TableModel | TocModel

export interface HeaderFooterSet {
  default?: BlockModel[]
  first?: BlockModel[]
  even?: BlockModel[]
}

export interface SectionModel {
  page: { width: number; height: number; orientation: 'portrait' | 'landscape' }
  margin: { top: number; right: number; bottom: number; left: number; header: number; footer: number; gutter: number }
  columns?: { count: number; space: number; separator: boolean }
  type: 'nextPage' | 'continuous' | 'evenPage' | 'oddPage'
  titlePage: boolean
  pageNumberStart?: number
  pageNumberFormat?: PageNumberFormat
  headers: HeaderFooterSet
  footers: HeaderFooterSet
  children: BlockModel[]
}

export interface ListModel {
  id: string
  ordered: boolean
  start: number
  /** Per level, 0–8. */
  levels: { format: ListFormat | 'bullet'; text: string; start: number; indent: number; hanging: number }[]
}

export interface DocxModel {
  meta: {
    title?: string
    subject?: string
    creator?: string
    description?: string
    keywords?: string
    lastModifiedBy?: string
    revision?: number
  }
  defaults: {
    font?: string
    size?: number
    color?: string
    lineHeight?: number
    spaceAfter?: number
    language?: string
  }
  headings: Partial<
    Record<HeadingLevel, RunStyleModel & Pick<ParagraphStyleModel, 'align' | 'spaceBefore' | 'spaceAfter' | 'keepNext'>>
  >
  styles?: IStylesOptions
  sections: SectionModel[]
  footnotes: { id: number; children: ParagraphModel[] }[]
  lists: ListModel[]
  evenAndOddHeaders: boolean
  /** True when the document has a table of contents, so Word fills it on open. */
  updateFields: boolean
}
