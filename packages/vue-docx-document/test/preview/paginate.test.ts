import { describe, expect, it } from 'vitest'

import type { TableModel } from '../../src'
import {
  FOOTNOTE_SEPARATOR,
  paginate,
  rowBreaks,
  type MeasuredItem,
  type PaginateSection,
} from '../../src/preview/paginate'
import { formatNumber } from '../../src/preview/format'

const item = (height: number, extra: Partial<MeasuredItem> = {}): MeasuredItem => ({
  height,
  breakBefore: false,
  keepNext: false,
  footnoteHeight: 0,
  ...extra,
})

const section = (items: MeasuredItem[], extra: Partial<PaginateSection> = {}): PaginateSection => ({
  type: 'nextPage',
  height: 100,
  columns: 1,
  sameGeometry: true,
  items,
  ...extra,
})

const layout = (sections: PaginateSection[]) =>
  paginate(sections).map((page) =>
    page.parts.map((part) => (part.rows ? `${part.item}:${part.rows.join('-')}+${part.repeat}` : part.item)),
  )

describe('paginate', () => {
  it('moves blocks that overflow to the next page', () => {
    expect(layout([section([item(40), item(40), item(40), item(100.4), item(150)])])).toEqual([[0, 1], [2], [3], [4]])
  })

  it('starts pages at breaks, keeps a heading with the next block, and counts footnotes', () => {
    expect(layout([section([item(10), item(10, { breakBefore: true }), item(10)])])).toEqual([[0], [1, 2]])
    expect(layout([section([item(60), item(20, { keepNext: true }), item(30)])])).toEqual([[0], [1, 2]])
    const notes = FOOTNOTE_SEPARATOR + 10
    expect(layout([section([item(50), item(100 - 50 - notes + 1, { footnoteHeight: 10 })])])).toEqual([[0], [1]])
    expect(layout([section([item(50), item(100 - 50 - notes, { footnoteHeight: 10 })])])).toEqual([[0, 1]])
  })

  it('divides heights between columns', () => {
    expect(layout([section([item(80), item(80), item(80)], { columns: 2 })])).toEqual([[0, 1], [2]])
  })

  it('splits tables between rows and repeats the header rows', () => {
    const rows = [
      { height: 20, header: true, splitBefore: false },
      { height: 30, header: false, splitBefore: true },
      { height: 30, header: false, splitBefore: true },
      // Rows 3 and 4 share a row span.
      { height: 30, header: false, splitBefore: true },
      { height: 30, header: false, splitBefore: false },
    ]
    expect(layout([section([item(10), item(140, { rows })])])).toEqual([[0, '1:0-3+0'], ['1:3-5+1']])
  })

  it('places a table that starts at a page break or does not fit at all', () => {
    const rows = [{ height: 30, header: false, splitBefore: false }]
    expect(layout([section([item(90), item(30, { rows })])])).toEqual([[0], ['1:0-1+0']])
    const tall = [{ height: 300, header: false, splitBefore: false }]
    expect(layout([section([item(300, { rows: tall })])])).toEqual([['0:0-1+0']])
  })

  it('numbers pages across sections and inserts blank pages for odd and even starts', () => {
    const pages = paginate([
      section([item(10)]),
      section([item(10)], { type: 'oddPage' }),
      section([item(10)], { type: 'continuous' }),
      section([item(10)], { type: 'continuous', sameGeometry: false }),
      section([item(10)], { type: 'evenPage', pageNumberStart: 10 }),
    ])
    expect(pages.map((page) => [page.section, page.number, page.blank, page.first])).toEqual([
      [0, 1, false, true],
      [0, 2, true, false],
      [1, 3, false, true],
      [3, 4, false, true],
      [4, 10, false, true],
    ])
    expect(pages[2]!.parts.map((part) => part.section)).toEqual([1, 2])
  })
})

describe('rowBreaks', () => {
  it('forbids breaks inside row spans', () => {
    const cell = (rowSpan = 1) => ({ colSpan: 1, rowSpan, verticalAlign: 'top' as const, children: [] })
    const table = {
      rows: [{ cells: [cell(2)] }, { cells: [cell()] }, { cells: [cell()] }],
    } as unknown as TableModel
    expect(rowBreaks(table)).toEqual([false, false, true])
  })
})

describe('formatNumber', () => {
  it('writes Word number formats', () => {
    expect(formatNumber(4)).toBe('4')
    expect(formatNumber(1994, 'upperRoman')).toBe('MCMXCIV')
    expect(formatNumber(4, 'lowerRoman')).toBe('iv')
    expect(formatNumber(28, 'lowerLetter')).toBe('bb')
    expect(formatNumber(3, 'upperLetter')).toBe('C')
    expect(formatNumber(0, 'lowerRoman')).toBe('0')
  })
})
