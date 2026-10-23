import type { SectionModel, TableModel } from '../core/model'
import { at } from './at'

// Pagination over measured heights, in points. Pure, so it can be tested without a layout engine.

export interface MeasuredRow {
  height: number
  /** Repeats at the top of each page when it's one of the table's first rows. */
  header: boolean
  /** The table may break before this row: no row span crosses it. */
  splitBefore: boolean
}

export interface MeasuredItem {
  height: number
  breakBefore: boolean
  keepNext: boolean
  /** The heights of the footnotes the item references. */
  footnoteHeight: number
  /** Set for tables, which break between rows. */
  rows?: MeasuredRow[]
}

export interface PaginateSection {
  type: SectionModel['type']
  pageNumberStart?: number
  /** The height of the page's body: the page less its top and bottom margins. */
  height: number
  columns: number
  /** A continuous section shares the previous section's page only if the pages look the same. */
  sameGeometry: boolean
  items: MeasuredItem[]
}

export interface PagePart {
  section: number
  item: number
  /** For a table: the rows on this page, `[start, end)`, and how many header rows repeat above them. */
  rows?: [number, number]
  repeat?: number
}

export interface Page {
  /** The section whose header, footer and size the page takes. */
  section: number
  /** The section's first page, which takes its `first` header. */
  first: boolean
  /** The page number as Word counts it. */
  number: number
  /** An empty page Word inserts so that an odd- or even-page section starts on the right side. */
  blank: boolean
  parts: PagePart[]
}

/** Room for the line above a page's footnotes. */
export const FOOTNOTE_SEPARATOR = 18

/** Measurements round; a block this much too tall still fits. */
const TOLERANCE = 0.5

/** Where a table may break: before any row that no row span reaches into. */
export const rowBreaks = (table: TableModel): boolean[] => {
  const reach = table.rows.map(() => 0)
  table.rows.forEach((row, index) => {
    for (const cell of row.cells) {
      for (let covered = index + 1; covered < index + cell.rowSpan && covered < reach.length; covered++) {
        reach[covered] = 1
      }
    }
  })
  return reach.map((covered, index) => index > 0 && covered === 0)
}

export const paginate = (sections: PaginateSection[]): Page[] => {
  const pages: Page[] = []
  let page: Page | undefined
  let used = 0
  let hasNotes = false

  const open = (section: number, first: boolean, number = (page?.number ?? 0) + 1): Page => {
    page = { section, first, number, blank: false, parts: [] }
    pages.push(page)
    used = 0
    hasNotes = false
    return page
  }

  sections.forEach((section, sectionIndex) => {
    let current: Page
    if (page && section.type === 'continuous' && section.sameGeometry) current = page
    else {
      let number = section.pageNumberStart ?? (page?.number ?? 0) + 1
      const parity = section.type === 'oddPage' ? 1 : section.type === 'evenPage' ? 0 : undefined
      if (page && parity !== undefined && Math.abs(number % 2) !== parity) {
        pages.push({ section: sectionIndex - 1, first: false, number, blank: true, parts: [] })
        number++
      }
      current = open(sectionIndex, true, number)
    }
    const capacity = section.height + TOLERANCE
    const cost = (height: number): number => height / section.columns
    const fits = (height: number): boolean => used + height <= capacity
    const notes = (item: MeasuredItem): number =>
      item.footnoteHeight > 0 ? item.footnoteHeight + (hasNotes ? 0 : FOOTNOTE_SEPARATOR) : 0
    const place = (part: PagePart, height: number, item: MeasuredItem, withNotes: boolean): void => {
      current.parts.push(part)
      used += height + (withNotes ? notes(item) : 0)
      if (withNotes && item.footnoteHeight > 0) hasNotes = true
    }

    const placeTable = (item: MeasuredItem, rows: MeasuredRow[], itemIndex: number): void => {
      let headerCount = 0
      while (headerCount < rows.length && at(rows, headerCount).header) headerCount++
      const headerHeight = rows.slice(0, headerCount).reduce((sum, row) => sum + row.height, 0)
      // Header rows stay with the first row after them.
      const canBreakBefore = (index: number): boolean => index > headerCount && at(rows, index).splitBefore
      let start = 0
      while (start < rows.length) {
        const repeat = start > 0 ? headerCount : 0
        const extra = start === 0 ? notes(item) : 0
        let height = repeat > 0 ? headerHeight : 0
        let end = start
        while (end < rows.length) {
          let groupEnd = end + 1
          while (groupEnd < rows.length && !canBreakBefore(groupEnd)) groupEnd++
          const group = rows.slice(end, groupEnd).reduce((sum, row) => sum + row.height, 0)
          // A group taller than an empty page goes on it anyway.
          if (!fits(cost(height + group) + extra) && (end > start || current.parts.length > 0)) break
          height += group
          end = groupEnd
        }
        if (end === start) {
          current = open(sectionIndex, false)
          continue
        }
        place({ section: sectionIndex, item: itemIndex, rows: [start, end], repeat }, cost(height), item, start === 0)
        start = end
        if (start < rows.length) current = open(sectionIndex, false)
      }
    }

    section.items.forEach((item, itemIndex) => {
      if (item.breakBefore && current.parts.length > 0) current = open(sectionIndex, false)
      if (item.rows) {
        placeTable(item, item.rows, itemIndex)
        return
      }
      const next = section.items[itemIndex + 1]
      const following = item.keepNext && next ? cost(next.rows ? (next.rows[0]?.height ?? 0) : next.height) : 0
      if (!fits(cost(item.height) + notes(item) + following) && current.parts.length > 0) {
        current = open(sectionIndex, false)
      }
      place({ section: sectionIndex, item: itemIndex }, cost(item.height), item, true)
    })
  })
  return pages
}
