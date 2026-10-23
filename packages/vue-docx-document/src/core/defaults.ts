import type { HeadingLevel, ListFormat } from '../components/types'
import type { BorderModel, DocxModel, RunStyleModel } from './model'

// Values both the writer and the preview read, so the preview shows what Word will.

/** Written into every file, so Word doesn't fall back to its own defaults (10pt Times New Roman). */
export const DOCUMENT_DEFAULTS = { font: 'Calibri', size: 11, lineHeight: 1.15, spaceAfter: 8 } as const

/** Word's built-in heading looks, before `Document.headings` changes them. */
export const HEADING_LOOKS: DocxModel['headings'] = {
  title: { size: 28, spaceAfter: 4 },
  1: { size: 16, color: '#2e74b5', spaceBefore: 12, keepNext: true },
  2: { size: 13, color: '#2e74b5', spaceBefore: 2, keepNext: true },
  3: { size: 12, color: '#1f4d78', spaceBefore: 2, keepNext: true },
  4: { italic: true, color: '#2e74b5', spaceBefore: 2, keepNext: true },
  5: { color: '#2e74b5', spaceBefore: 2, keepNext: true },
  6: { color: '#1f4d78', spaceBefore: 2, keepNext: true },
}

export const HEADING_LEVELS: HeadingLevel[] = ['title', 1, 2, 3, 4, 5, 6]

/** Word's paragraph style id for a heading level. */
export const headingStyleId = (level: HeadingLevel): string => (level === 'title' ? 'Title' : `Heading${level}`)

export const LINK_STYLE: RunStyleModel = { color: '#0563c1', underline: 'single' }

/** Footnote text, as Word's Footnote Text style sets it. */
export const FOOTNOTE_SIZE = 10

/** The look of a table of contents' title paragraph. */
export const TOC_TITLE = { size: 14, spaceAfter: 6 } as const

export const DEFAULT_BORDER: BorderModel = { style: 'single', size: 0.5, color: '#000000', space: 0 }

/** Word's default cell margins: 5.4pt left and right, none above and below. */
export const CELL_PADDING = { top: 0, right: 5.4, bottom: 0, left: 5.4 } as const

export const MAX_LIST_LEVELS = 9
export const BULLETS = ['•', '◦', '▪'] as const
export const ORDERED_FORMATS: ListFormat[] = ['decimal', 'lowerLetter', 'lowerRoman']
/** Each list level indents a further half inch; the marker hangs a quarter inch. */
export const LIST_INDENT = 36
export const LIST_HANGING = 18

/** Page sizes in points, portrait. */
export const PAGE_SIZES = {
  A3: { width: 841.89, height: 1190.551 },
  A4: { width: 595.276, height: 841.89 },
  A5: { width: 419.528, height: 595.276 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
  Tabloid: { width: 792, height: 1224 },
} as const

export const PAGE_MARGIN = 72
export const HEADER_MARGIN = 36
export const COLUMN_SPACE = 36
