import type { IStylesOptions } from 'docx'

import type { Length } from '../core/units'

export type { Length }

/** `#rgb`, `#rrggbb`, `rrggbb`, or a CSS basic color name such as `black` or `navy`. */
export type Color = string

export type Align = 'left' | 'center' | 'right' | 'justify'

export type HeadingLevel = 'title' | 1 | 2 | 3 | 4 | 5 | 6

/** Word's fixed highlight palette. Use `shading` for any other background color. */
export type HighlightColor =
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'magenta'
  | 'blue'
  | 'red'
  | 'darkBlue'
  | 'darkCyan'
  | 'darkGreen'
  | 'darkMagenta'
  | 'darkRed'
  | 'darkYellow'
  | 'darkGray'
  | 'lightGray'
  | 'black'
  | 'white'

export type UnderlineStyle = 'single' | 'double' | 'thick' | 'dotted' | 'dash' | 'wave' | 'words'

/** Character formatting. Set on any element from `<Table>` down; the nearest one wins. */
export interface RunStyle {
  bold?: boolean
  italic?: boolean
  /** `true` is a single underline. */
  underline?: boolean | UnderlineStyle
  strike?: boolean
  doubleStrike?: boolean
  color?: Color
  highlight?: HighlightColor
  /** Background color behind the text. */
  shading?: Color
  font?: string
  /** Points. */
  size?: number
  superscript?: boolean
  subscript?: boolean
  allCaps?: boolean
  smallCaps?: boolean
  characterSpacing?: Length
}

export type BorderStyle = 'single' | 'double' | 'dotted' | 'dashed' | 'thick' | 'none'

export interface BorderSide {
  style?: BorderStyle
  /** Line width in points. Default 0.5. */
  size?: number
  color?: Color
  /** Gap between the border and the content, in points. */
  space?: number
}

export interface Sides<T> {
  top?: T
  right?: T
  bottom?: T
  left?: T
}

export interface TabStop {
  position: Length
  type?: 'left' | 'center' | 'right' | 'decimal'
  leader?: 'none' | 'dot' | 'hyphen' | 'underscore'
}

export interface ParagraphStyle {
  align?: Align
  spaceBefore?: Length
  spaceAfter?: Length
  /** A multiple of the font's line height, such as `1.15`. */
  lineHeight?: number
  indent?: Length
  indentRight?: Length
  firstLine?: Length
  hanging?: Length
  keepNext?: boolean
  keepLines?: boolean
  pageBreakBefore?: boolean
  border?: Sides<BorderSide>
  background?: Color
  tabStops?: TabStop[]
}

export interface DocumentProps {
  title?: string
  subject?: string
  creator?: string
  description?: string
  keywords?: string
  lastModifiedBy?: string
  revision?: number
  /** BCP 47 language of the text, such as `en-US` or `sk-SK`, so Word checks spelling in it. */
  language?: string
  /** Default font for the whole document. */
  font?: string
  /** Default font size in points. */
  fontSize?: number
  color?: Color
  lineHeight?: number
  /** Space after each paragraph unless a paragraph sets its own. */
  spaceAfter?: Length
  /** Overrides the look of Word's built-in Title and Heading 1–6 styles. */
  headings?: Partial<
    Record<HeadingLevel, RunStyle & Pick<ParagraphStyle, 'align' | 'spaceBefore' | 'spaceAfter' | 'keepNext'>>
  >
  /** Raw `docx` styles, merged after the ones built from the props above. */
  styles?: IStylesOptions
  /** Called with each Blob that `toBlob()` or `useDocx()` produces. */
  onRender?: (info: { blob: Blob }) => void
}

export type PageSize = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | { width: Length; height: Length }

export interface PageMargin extends Sides<Length> {
  header?: Length
  footer?: Length
  gutter?: Length
}

export type PageNumberFormat = 'decimal' | 'upperRoman' | 'lowerRoman' | 'upperLetter' | 'lowerLetter'

export interface SectionProps {
  /** Default `A4`. */
  size?: PageSize
  orientation?: 'portrait' | 'landscape'
  /** One length for all four sides, or per side. Default 1 inch. */
  margin?: Length | PageMargin
  columns?: number | { count: number; space?: Length; separator?: boolean }
  /** How this section starts. Default `nextPage`. */
  type?: 'nextPage' | 'continuous' | 'evenPage' | 'oddPage'
  pageNumberStart?: number
  pageNumberFormat?: PageNumberFormat
}

export interface HeaderFooterProps {
  /** `first` applies to the section's first page, `even` to even pages. Default `default`. */
  type?: 'default' | 'first' | 'even'
}

export interface ParagraphProps extends RunStyle, ParagraphStyle {
  heading?: HeadingLevel
  /** A paragraph style id from `Document.styles`. */
  styleId?: string
}

export interface TextRunProps extends RunStyle {
  /**
   * The text, if not given as children. A line feed (`\n`) in it, or in any text child,
   * starts a new line, like `<Break />`.
   */
  text?: string
}

export interface LinkProps extends RunStyle {
  /** An `http`, `https`, `mailto` or `tel` URL. */
  href?: string
  /** The `id` of a `<Bookmark>` in this document. */
  anchor?: string
}

export interface BookmarkProps {
  /**
   * The bookmark name Word stores, so it follows Word's rules: a letter, then letters, digits
   * or underscores, 40 characters at most, unique in the document. Anything else throws.
   */
  id: string
}

export interface PageNumberProps extends RunStyle {
  /** Default `current`. */
  type?: 'current' | 'total' | 'section-total'
}

/**
 * A data URI, an `http(s)` URL, or the bytes. URLs that redirect are refused, so the
 * document only holds images from the address it names.
 */
export type ImageSource = string | Uint8Array | ArrayBuffer | Blob

export type ImageType = 'png' | 'jpg' | 'gif' | 'bmp' | 'svg'

export interface ImageProps {
  src: ImageSource
  /** Required for SVG: Word shows this raster image where it can't draw SVG. */
  fallback?: ImageSource
  /** Overrides the type sniffed from the bytes. */
  type?: ImageType
  width?: Length
  height?: Length
  alt?: string
  title?: string
  /** Only for an image placed directly in a block container. */
  align?: Exclude<Align, 'justify'>
}

export type TableBorders = Sides<BorderSide> & { insideH?: BorderSide; insideV?: BorderSide }

export interface TableProps extends RunStyle {
  /** Column widths; also fixes the column count. */
  columnWidths?: Length[]
  /** A length, or a percentage of the text width such as `'100%'`. Default `'100%'`. */
  width?: Length | `${number}%`
  /**
   * `fixed` keeps the column widths; `auto` lets Word fit columns to their content.
   * Default `fixed` when `columnWidths` is set, `auto` otherwise.
   */
  layout?: 'fixed' | 'auto'
  align?: 'left' | 'center' | 'right'
  /** `'none'` removes every border; an object draws only the sides it names. Default: 0.5pt single lines. */
  borders?: TableBorders | 'none'
  cellPadding?: Length | Sides<Length>
}

export interface TableRowProps extends RunStyle {
  /** Repeat this row at the top of every page the table spans. */
  header?: boolean
  cantSplit?: boolean
  height?: Length
  background?: Color
}

export interface TableCellProps extends RunStyle {
  colSpan?: number
  /** Merges the cell down this many rows. Leave the cells it covers out of the rows below. */
  rowSpan?: number
  background?: Color
  verticalAlign?: 'top' | 'center' | 'bottom'
  width?: Length
  borders?: Sides<BorderSide> | 'none'
  padding?: Length | Sides<Length>
  /** Alignment of the paragraphs created for loose text in the cell. */
  align?: Align
}

export type ListFormat = 'decimal' | 'lowerLetter' | 'upperLetter' | 'lowerRoman' | 'upperRoman'

export interface ListProps extends RunStyle {
  ordered?: boolean
  /** First number of an ordered list. Default 1. */
  start?: number
  /**
   * Number format of an ordered list. Default: decimal, lower letter, lower roman by level. A nested
   * `<List>` sets the format of its own level only.
   */
  format?: ListFormat
  /** The bullet character of an unordered list. Default `•`, `◦`, `▪` by level. */
  bullet?: string
  /**
   * Legal numbering: 1., 1.1., 1.1.1. and so on, decimal at every level. Implies `ordered`.
   * Set it on the outer list; nested lists follow it, and `format` is ignored then.
   */
  legal?: boolean
}

export type ListItemProps = Omit<ParagraphProps, 'heading'> & {
  /**
   * Makes the item a numbered heading: it takes the Heading style and keeps its list number,
   * so it shows in Word's navigation pane and in a `<TableOfContents>`.
   */
  heading?: Exclude<HeadingLevel, 'title'>
}

export interface TableOfContentsProps {
  title?: string
  /** Heading levels to list. Default `[1, 3]`. */
  levels?: [number, number]
  /** Make the entries links to their headings. Default `true`. */
  hyperlinks?: boolean
}
