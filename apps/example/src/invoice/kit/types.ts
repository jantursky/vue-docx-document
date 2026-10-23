import type { DefineComponent } from 'vue'

// The invoice template is written against these components. `docx.ts` and `pdf.ts` each
// implement all of them with identical props, so one template renders to both formats.
// Lengths are points, colors are `#rrggbb`.

export interface KitDocumentProps {
  title: string
  author: string
  subject: string
  language: string
}

export interface ColumnsProps {
  /** Space between columns. */
  gap?: number
}

export interface ColumnProps {
  /** Share of the row: columns of width 2 and 1 split it two to one. */
  width: number
  background?: string
  padding?: number
}

export interface LineProps {
  /** Default 9. */
  size?: number
  bold?: boolean
  /** Uppercase with wide tracking, for labels. */
  caps?: boolean
  color?: string
  align?: 'left' | 'right'
  /** Space below the line. */
  after?: number
}

export interface SpacerProps {
  height: number
}

export interface ImgProps {
  src: string
  alt: string
  /** Give one or both; with one, the other follows the image's own proportions. */
  width?: number
  height?: number
  align?: 'left' | 'right'
}

export interface ItemsTableColumn {
  header: string
  /** Share of the table's width, like `ColumnProps.width`. */
  width: number
  align?: 'left' | 'right'
}

export interface ItemsTableProps {
  columns: ItemsTableColumn[]
  rows: string[][]
  /** A closing row in bold, for totals. */
  footer?: string[]
  /** Fills the header row. */
  accent: string
  /** Default: the full width of the page. */
  width?: number
  align?: 'left' | 'right'
}

export interface PageFooterProps {
  text: string
  /** Where the page numbers go, such as `Page {page} of {total}`. */
  pageTemplate: string
}

/** A kit component: typed props, content in the default slot. */
export type KitComponent<Props> = DefineComponent<Props>

export interface Kit {
  KitDocument: KitComponent<KitDocumentProps>
  Columns: KitComponent<ColumnsProps>
  Column: KitComponent<ColumnProps>
  Line: KitComponent<LineProps>
  Spacer: KitComponent<SpacerProps>
  Img: KitComponent<ImgProps>
  ItemsTable: KitComponent<ItemsTableProps>
  PageFooter: KitComponent<PageFooterProps>
}
