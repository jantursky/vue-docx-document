import { describe, expect, it, vi } from 'vitest'
import { defineComponent, Fragment, h, type VNodeChild } from 'vue'

import {
  Bookmark,
  Break,
  ColumnBreak,
  Document,
  Footer,
  Footnote,
  Header,
  Image,
  Link,
  List,
  ListItem,
  PageBreak,
  PageNumber,
  Paragraph,
  Section,
  Tab,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  renderToModel,
  type DocxModel,
  type ParagraphModel,
  type TableModel,
} from '../../src'
import Report from '../fixtures/Report.vue'
import { PNG, singleSection } from '../fixtures'

const resolveSection = async (children: () => VNodeChild, sectionProps = {}, documentProps = {}) =>
  renderToModel(singleSection(children, sectionProps, documentProps))

const body = async (children: () => VNodeChild) => (await resolveSection(children)).sections[0]!.children

const first = async (children: () => VNodeChild) => (await body(children))[0] as ParagraphModel

const rejects = (children: () => VNodeChild, message: string) =>
  expect(resolveSection(children)).rejects.toThrow(message)

describe('document', () => {
  it('fills in metadata, defaults and heading looks', async () => {
    const model = await resolveSection(
      () => h(Paragraph, null, () => 'x'),
      {},
      {
        title: 'T',
        creator: 'Ada',
        revision: 3,
        font: 'Arial',
        fontSize: 12,
        color: 'navy',
        lineHeight: 1.5,
        spaceAfter: '6pt',
        language: 'sk-SK',
        headings: { 1: { size: 20, bold: true, spaceBefore: '1in', align: 'center' }, title: { color: 'red' } },
        styles: { paragraphStyles: [{ id: 'Quote', name: 'Quote' }] },
      },
    )
    expect(model.meta).toEqual({ title: 'T', creator: 'Ada', revision: 3 })
    expect(model.defaults).toEqual({
      font: 'Arial',
      size: 12,
      color: '#000080',
      lineHeight: 1.5,
      spaceAfter: 6,
      language: 'sk-SK',
    })
    expect(model.headings[1]).toEqual({
      size: 20,
      color: '#2e74b5',
      bold: true,
      spaceBefore: 72,
      keepNext: true,
      align: 'center',
    })
    expect(model.headings.title).toMatchObject({ size: 28, color: '#ff0000' })
    expect(model.styles?.paragraphStyles).toHaveLength(1)
  })

  it('uses Word-like defaults', async () => {
    const model = await resolveSection(() => 'x')
    expect(model.defaults).toEqual({ font: 'Calibri', size: 11, lineHeight: 1.15, spaceAfter: 8 })
    expect(model.updateFields).toBe(false)
    expect(model.evenAndOddHeaders).toBe(false)
  })

  it('drops text in <Document> with a warning and rejects other children', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const model = await renderToModel(
      defineComponent(() => () => h(Document, null, () => ['Stray words', h(Section, null, () => 'ok')])),
    )
    expect(model.sections).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Text "Stray words" inside <Document> is dropped'))
    warn.mockRestore()
    await expect(renderToModel(defineComponent(() => () => h(Document, null, () => h(Paragraph))))).rejects.toThrow(
      "<Paragraph> can't be inside <Document>.",
    )
    await expect(renderToModel(defineComponent(() => () => h(Document)))).rejects.toThrow('at least one <Section>')
  })

  it('resolves an SFC with props, keeping the space between runs', async () => {
    const model = await renderToModel(Report, { title: 'Report', points: ['Speed'] })
    const [title, point] = model.sections[0]!.children as ParagraphModel[]
    expect(title!.style.heading).toBe('title')
    expect(point!.children).toEqual([
      { kind: 'text', text: 'Speed', style: { bold: true } },
      { kind: 'text', text: ' ', style: {} },
      { kind: 'text', text: 'matters', style: { italic: true } },
    ])
    expect(model.sections[0]!.footers.default).toHaveLength(1)
  })
})

describe('sections', () => {
  it('resolves page sizes, orientation, margins and columns', async () => {
    const section = async (props: Record<string, unknown>) => (await resolveSection(() => 'x', props)).sections[0]!
    expect((await section({})).page).toEqual({ width: 595.276, height: 841.89, orientation: 'portrait' })
    expect((await section({ size: 'Letter', orientation: 'landscape' })).page).toEqual({
      width: 792,
      height: 612,
      orientation: 'landscape',
    })
    expect((await section({ size: { width: '11in', height: '8.5in' } })).page.orientation).toBe('landscape')
    expect((await section({ size: { width: 800, height: 600 }, orientation: 'portrait' })).page).toMatchObject({
      width: 600,
      height: 800,
    })
    expect((await section({})).margin).toEqual({
      top: 72,
      right: 72,
      bottom: 72,
      left: 72,
      header: 36,
      footer: 36,
      gutter: 0,
    })
    expect((await section({ margin: '1cm' })).margin.left).toBeCloseTo(28.346)
    expect((await section({ margin: { top: 10, header: 5, footer: 6, gutter: 7 } })).margin).toEqual({
      top: 10,
      right: 72,
      bottom: 72,
      left: 72,
      header: 5,
      footer: 6,
      gutter: 7,
    })
    expect((await section({ columns: 2 })).columns).toEqual({ count: 2, space: 36, separator: false })
    expect((await section({ columns: { count: 3, space: '0.25in', separator: true } })).columns).toEqual({
      count: 3,
      space: 18,
      separator: true,
    })
    expect(await section({ type: 'oddPage', pageNumberStart: 5, pageNumberFormat: 'upperRoman' })).toMatchObject({
      type: 'oddPage',
      pageNumberStart: 5,
      pageNumberFormat: 'upperRoman',
    })
    await expect(resolveSection(() => 'x', { size: 'B5' })).rejects.toThrow('Unknown page size "B5"')
  })

  it('sorts headers and footers by type and sets titlePage and evenAndOddHeaders', async () => {
    const model = await resolveSection(() => [
      h(Header, null, () => 'Default'),
      h(Header, { type: 'first' }),
      h(Footer, { type: 'even' }, () => ['Page ', h(PageNumber, { type: 'total' })]),
      'Body',
    ])
    const [section] = model.sections
    expect(section!.headers.default).toHaveLength(1)
    expect(section!.headers.first).toEqual([])
    expect(section!.titlePage).toBe(true)
    expect(model.evenAndOddHeaders).toBe(true)
    expect((section!.footers.even![0] as ParagraphModel).children[1]).toEqual({
      kind: 'pageNumber',
      type: 'total',
      style: {},
    })
    // Header paragraphs have no space after unless they ask for it.
    expect((section!.headers.default![0] as ParagraphModel).style.spaceAfter).toBe(0)
    expect(section!.children).toHaveLength(1)
  })

  it('rejects duplicate and unknown header types', async () => {
    await rejects(() => [h(Header), h(Header)], 'A <Section> has two <Header type="default">')
    await rejects(() => h(Footer, { type: 'odd' as never }), '<Footer> type="odd" is not default, first or even.')
  })
})

describe('blocks and implicit paragraphs', () => {
  it('wraps loose inline content, sharing one paragraph between blocks', async () => {
    const blocks = await body(() => [
      'Hello ',
      h(TextRun, { bold: true }, () => 'world'),
      h(Paragraph, null, () => 'Own'),
      ' ',
      h(Break),
      h(Tab),
    ])
    expect(blocks).toHaveLength(3)
    expect((blocks[0] as ParagraphModel).children.map((item) => item.kind)).toEqual(['text', 'text'])
    expect((blocks[2] as ParagraphModel).children.map((item) => item.kind)).toEqual(['break', 'tab'])
  })

  it('trims whitespace at paragraph edges and around breaks', async () => {
    const paragraph = await first(() => h(Paragraph, null, () => ['  Line one ', h(Break), ' line two  ']))
    expect(paragraph.children).toEqual([
      { kind: 'text', text: 'Line one', style: {} },
      { kind: 'break' },
      { kind: 'text', text: 'line two', style: {} },
    ])
  })

  it('keeps an empty paragraph as a blank line with its run formatting', async () => {
    const blocks = await body(() => [h(Paragraph), h(Paragraph, { size: 20, spaceAfter: 0 })])
    expect(blocks).toEqual([
      { kind: 'paragraph', style: {}, children: [] },
      { kind: 'paragraph', style: { spaceAfter: 0, mark: { size: 20 } }, children: [] },
    ])
  })

  it('trims across the empty text Vue leaves for fragments', async () => {
    const paragraph = await first(() =>
      h(Paragraph, null, () => ['A', h(Break), h(Fragment, [' B ']), h(Fragment, ['C  ']), h(Fragment, [])]),
    )
    expect(paragraph.children).toEqual([
      { kind: 'text', text: 'A', style: {} },
      { kind: 'break' },
      { kind: 'text', text: 'B ', style: {} },
      { kind: 'text', text: 'C', style: {} },
    ])
  })

  it('makes block images and page breaks paragraphs of their own', async () => {
    const blocks = await body(() => [
      h(Image, { src: PNG, align: 'center', alt: 'Logo', title: 'Brand' }),
      h(PageBreak),
    ])
    expect(blocks[0]).toMatchObject({
      kind: 'paragraph',
      style: { align: 'center' },
      children: [{ kind: 'image', type: 'png', width: 1.5, height: 0.75, alt: 'Logo', title: 'Brand' }],
    })
    expect(blocks[1]).toEqual({ kind: 'paragraph', style: {}, children: [{ kind: 'pageBreak' }] })
  })

  it('reports misplaced elements', async () => {
    await rejects(() => h(TableRow), '<TableRow> must be a direct child of <Table>, not of <Section>.')
    await rejects(
      () => h(Table, null, () => h(TableCell)),
      '<TableCell> must be a direct child of <TableRow>, not of <Table>.',
    )
    await rejects(() => h(ListItem), '<ListItem> must be a direct child of <List>, not of <Section>.')
    await rejects(() => h(Paragraph, null, () => h(Paragraph)), "<Paragraph> can't be inside <Paragraph>.")
    await rejects(() => h(TextRun, null, () => h(Table)), "<Table> can't be inside <TextRun>.")
    await rejects(
      () => h(Header, null, () => h(TableOfContents)),
      '<TableOfContents> must be a direct child of <Section>',
    )
    await rejects(() => h(Section), '<Section> must be a direct child of <Document>')
    await rejects(() => h(Table, null, () => 'loose'), 'Text inside <Table> must be in a <TableRow>.')
    await rejects(() => h(List, null, () => 'loose'), 'Text inside <List> must be in a <ListItem>.')
    await rejects(() => h(List, null, () => h(Paragraph)), "<Paragraph> can't be inside <List>.")
  })
})

describe('runs', () => {
  it('cascades run styles, nearest first', async () => {
    const model = await resolveSection(() =>
      h(Table, { font: 'Arial', color: 'red' }, () =>
        h(TableRow, { size: 9 }, () =>
          h(TableCell, { italic: true }, () =>
            h(Paragraph, { color: '#00f' }, () => [
              h(TextRun, { color: 'green', underline: true }, () => 'Deep'),
              'Flat',
            ]),
          ),
        ),
      ),
    )
    const cell = (model.sections[0]!.children[0] as TableModel).rows[0]!.cells[0]!
    const [deep, flat] = (cell.children[0] as ParagraphModel).children
    expect(deep).toEqual({
      kind: 'text',
      text: 'Deep',
      style: { font: 'Arial', color: '#008000', size: 9, italic: true, underline: 'single' },
    })
    expect(flat).toMatchObject({ style: { color: '#0000ff' } })
  })

  it('maps every run prop', async () => {
    const paragraph = await first(() =>
      h(TextRun, {
        bold: true,
        italic: false,
        underline: 'wave',
        strike: true,
        doubleStrike: false,
        highlight: 'yellow',
        shading: 'silver',
        superscript: true,
        subscript: false,
        allCaps: true,
        smallCaps: false,
        characterSpacing: '2px',
        text: 'Styled',
      }),
    )
    expect(paragraph.children[0]).toEqual({
      kind: 'text',
      text: 'Styled',
      style: {
        bold: true,
        italic: false,
        underline: 'wave',
        strike: true,
        doubleStrike: false,
        highlight: 'yellow',
        shading: '#c0c0c0',
        superscript: true,
        subscript: false,
        allCaps: true,
        smallCaps: false,
        characterSpacing: 1.5,
      },
    })
  })

  it('maps paragraph props', async () => {
    const paragraph = await first(() =>
      h(
        Paragraph,
        {
          heading: '2' as never,
          styleId: 'Quote',
          align: 'justify',
          spaceBefore: '0.5in',
          spaceAfter: 4,
          lineHeight: 1.5,
          indent: 36,
          indentRight: 18,
          firstLine: 9,
          hanging: '0.125in',
          keepNext: true,
          keepLines: true,
          pageBreakBefore: true,
          border: { bottom: { style: 'double', size: 1, color: 'blue', space: 2 }, top: {} },
          background: '#eee',
          tabStops: [{ position: '3in', type: 'right', leader: 'dot' }, { position: 36 }],
        },
        () => 'Text',
      ),
    )
    expect(paragraph.style).toEqual({
      heading: 2,
      styleId: 'Quote',
      align: 'justify',
      spaceBefore: 36,
      spaceAfter: 4,
      lineHeight: 1.5,
      indent: { left: 36, right: 18, firstLine: 9, hanging: 9 },
      keepNext: true,
      keepLines: true,
      pageBreakBefore: true,
      border: {
        top: { style: 'single', size: 0.5, color: '#000000', space: 0 },
        bottom: { style: 'double', size: 1, color: '#0000ff', space: 2 },
      },
      background: '#eeeeee',
      tabStops: [
        { position: 216, type: 'right', leader: 'dot' },
        { position: 36, type: 'left', leader: 'none' },
      ],
    })
    await rejects(() => h(Paragraph, { heading: 7 as never }), 'heading=7 is not a heading level')
  })

  it('resolves links, warning about unsafe ones', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const paragraph = await first(() =>
      h(Paragraph, null, () => [
        h(Link, { href: ' https://vuejs.org ' }, () => 'Vue'),
        h(Link, { href: 'mailto:ada@example.com', color: 'red', underline: false }, () => 'Mail'),
        h(Link, { href: 'javascript:alert(1)' }, () => 'Bad'),
        h(Link, { anchor: 'intro' }, () => 'Jump'),
        h(Bookmark, { id: 'intro' }, () => 'Here'),
        h(Link, { anchor: 'nowhere' }, () => 'Lost'),
      ]),
    )
    expect(paragraph.children).toEqual([
      {
        kind: 'link',
        href: 'https://vuejs.org',
        children: [{ kind: 'text', text: 'Vue', style: { color: '#0563c1', underline: 'single' } }],
      },
      {
        kind: 'link',
        href: 'mailto:ada@example.com',
        children: [{ kind: 'text', text: 'Mail', style: { color: '#ff0000' } }],
      },
      { kind: 'text', text: 'Bad', style: {} },
      { kind: 'link', anchor: 'intro', children: [expect.objectContaining({ text: 'Jump' })] },
      { kind: 'bookmark', id: 'intro', children: [{ kind: 'text', text: 'Here', style: {} }] },
      { kind: 'link', anchor: 'nowhere', children: [expect.objectContaining({ text: 'Lost' })] },
    ])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"javascript:alert(1)" is not http, https, mailto or tel'),
    )
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('<Link anchor="nowhere"> points at no <Bookmark id="nowhere">'),
    )
    warn.mockRestore()
    await rejects(() => h(Link, null, () => 'x'), '<Link> needs an href or an anchor.')
    await rejects(
      () => h(Link, { href: 'https://a.b' }, () => h(Link, { href: 'https://c.d' })),
      "can't be inside another <Link>",
    )
    const name = 'a letter, then letters, digits or underscores, 40 characters at most.'
    await rejects(() => h(Bookmark), `<Bookmark id="undefined"> is not a bookmark name Word takes: ${name}`)
    await rejects(() => h(Bookmark, { id: 'my section' }), '<Bookmark id="my section"> is not a bookmark name')
    await rejects(() => h(Bookmark, { id: '1st' }), '<Bookmark id="1st"> is not a bookmark name')
    await rejects(() => h(Bookmark, { id: `a${'b'.repeat(40)}` }), 'is not a bookmark name')
    await rejects(
      () => [h(Bookmark, { id: 'Same_1' }), h(Bookmark, { id: 'Same_1' })],
      'Two <Bookmark>s have the id "Same_1".',
    )
  })

  it('keeps whitespace inside links and bookmarks, trimming only at paragraph edges', async () => {
    const inner = await first(() =>
      h(Paragraph, null, () => ['see', h(Link, { href: 'https://a.b' }, () => ' docs '), 'now']),
    )
    expect(inner.children).toEqual([
      expect.objectContaining({ text: 'see' }),
      { kind: 'link', href: 'https://a.b', children: [expect.objectContaining({ text: ' docs ' })] },
      expect.objectContaining({ text: 'now' }),
    ])
    const edges = await first(() =>
      h(Paragraph, null, () => [
        h(Bookmark, { id: 'start' }, () => '  Top '),
        'and ',
        h(Link, { anchor: 'start' }, () => ' up  '),
      ]),
    )
    expect(edges.children).toEqual([
      { kind: 'bookmark', id: 'start', children: [{ kind: 'text', text: 'Top ', style: {} }] },
      { kind: 'text', text: 'and ', style: {} },
      { kind: 'link', anchor: 'start', children: [expect.objectContaining({ text: ' up' })] },
    ])
  })

  it('turns line feeds in text into line breaks', async () => {
    const paragraph = await first(() =>
      h(Paragraph, null, () => [h(TextRun, { text: 'One\nTwo', bold: true }), ' and\r\nthree']),
    )
    expect(paragraph.children).toEqual([
      { kind: 'text', text: 'One', style: { bold: true } },
      { kind: 'break' },
      { kind: 'text', text: 'Two', style: { bold: true } },
      { kind: 'text', text: ' and', style: {} },
      { kind: 'break' },
      { kind: 'text', text: 'three', style: {} },
    ])
  })

  it('resolves breaks and fields', async () => {
    const paragraph = await first(() =>
      h(Paragraph, null, () => [h(ColumnBreak), h(PageBreak), h(PageNumber, { type: 'section-total', bold: true })]),
    )
    expect(paragraph.children).toEqual([
      { kind: 'columnBreak' },
      { kind: 'pageBreak' },
      { kind: 'pageNumber', type: 'section-total', style: { bold: true } },
    ])
  })
})

describe('lists', () => {
  it('numbers each top-level list separately and nests levels', async () => {
    const model = await resolveSection(() => [
      h(List, { ordered: true, start: 3, color: 'red' }, () => [
        h(ListItem, null, () => 'One'),
        h(ListItem, { bold: true }, () => [
          'Two',
          h(List, { bullet: '–' }, () => [h(ListItem, null, () => 'Inner'), h(ListItem, null, () => 'Inner 2')]),
          h(List, { ordered: true, format: 'upperRoman' }, () => h(ListItem, null, () => 'Ignored config')),
          'After',
        ]),
      ]),
      h(List, null, () => h(ListItem, { heading: 1 } as never, () => 'Bullet')),
    ])
    const paragraphs = model.sections[0]!.children as ParagraphModel[]
    expect(paragraphs.map((paragraph) => paragraph.style.list)).toEqual([
      { id: 'list1', level: 0 },
      { id: 'list1', level: 0 },
      { id: 'list1', level: 1 },
      { id: 'list1', level: 1 },
      { id: 'list1', level: 1 },
      undefined,
      { id: 'list2', level: 0 },
    ])
    expect(paragraphs[1]!.children[0]).toMatchObject({ style: { color: '#ff0000', bold: true } })
    expect(paragraphs[5]).toMatchObject({ style: { indent: { left: 36 } }, children: [{ text: 'After' }] })
    expect(paragraphs[6]!.style.heading).toBeUndefined()
    const [ordered, bullets] = model.lists
    expect(ordered).toMatchObject({ id: 'list1', ordered: true, start: 3 })
    expect(ordered!.levels).toHaveLength(9)
    expect(ordered!.levels[0]).toEqual({ format: 'decimal', text: '%1.', start: 3, indent: 36, hanging: 18 })
    // The first nested list sets level 1; the next one at that level doesn't change it.
    expect(ordered!.levels[1]).toEqual({ format: 'bullet', text: '–', start: 1, indent: 72, hanging: 18 })
    expect(ordered!.levels[2]).toMatchObject({ format: 'lowerRoman', text: '%3.' })
    expect(bullets!.levels.slice(0, 4).map((level) => level.text)).toEqual(['•', '◦', '▪', '•'])
  })

  it('stops at nine levels', async () => {
    let nested: VNodeChild = h(ListItem, null, () => 'deep')
    for (let level = 0; level < 10; level++) {
      const inner: VNodeChild = nested
      nested = h(ListItem, null, (): VNodeChild => h(List, null, (): VNodeChild => inner))
    }
    const tree = nested
    await rejects(() => h(List, null, () => tree), 'Lists nest 9 levels deep at most.')
  })
})

describe('tables', () => {
  it('resolves widths, borders, spans and cell defaults', async () => {
    const [table] = (await body(() =>
      h(
        Table,
        {
          columnWidths: ['2in', 72],
          width: 300,
          align: 'center',
          borders: { bottom: { size: 2 }, insideH: { style: 'dotted' } },
          cellPadding: 4,
        },
        () => [
          h(TableRow, { header: true, cantSplit: true, height: 20, background: 'yellow' }, () => [
            h(TableCell, { colSpan: 2 }, () => 'Head'),
          ]),
          h(TableRow, null, () => [
            h(
              TableCell,
              {
                rowSpan: 2,
                background: 'gray',
                verticalAlign: 'center',
                width: '1in',
                borders: 'none',
                padding: { left: 2 },
                align: 'right',
              },
              () => 'Span',
            ),
            h(TableCell, { borders: { top: { color: 'red' } } }),
          ]),
        ],
      ),
    )) as TableModel[]
    expect(table).toMatchObject({
      kind: 'table',
      width: { value: 300, unit: 'pt' },
      columnWidths: [144, 72],
      layout: 'fixed',
      align: 'center',
      borders: {
        bottom: { style: 'single', size: 2, color: '#000000', space: 0 },
        insideH: { style: 'dotted', size: 0.5, color: '#000000', space: 0 },
      },
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
    })
    expect(table!.rows[0]).toMatchObject({ header: true, cantSplit: true, height: 20 })
    expect(table!.rows[0]!.cells[0]).toMatchObject({
      colSpan: 2,
      rowSpan: 1,
      background: '#ffff00',
      verticalAlign: 'top',
    })
    expect(table!.rows[1]!.cells[0]).toEqual({
      colSpan: 1,
      rowSpan: 2,
      background: '#808080',
      verticalAlign: 'center',
      width: 72,
      borders: 'none',
      padding: { left: 2 },
      children: [
        {
          kind: 'paragraph',
          style: { align: 'right', spaceAfter: 0 },
          children: [expect.objectContaining({ text: 'Span' })],
        },
      ],
    })
    expect(table!.rows[1]!.cells[1]).toMatchObject({ borders: { top: { color: '#ff0000' } }, children: [] })
  })

  it('defaults to a full-width table with thin borders', async () => {
    const [table] = (await body(() =>
      h(Table, { width: '50%' }, () => h(TableRow, null, () => h(TableCell))),
    )) as TableModel[]
    expect(table!.width).toEqual({ value: 50, unit: '%' })
    expect(table!.layout).toBe('auto')
    expect(Object.keys(table!.borders)).toEqual(['top', 'right', 'bottom', 'left', 'insideH', 'insideV'])
    const [bare] = (await body(() => h(Table, { borders: 'none' }, () => h(TableRow)))) as TableModel[]
    expect(bare!.borders).toBe('none')
    expect(bare!.width).toEqual({ value: 100, unit: '%' })
    const row = () => h(TableRow, null, () => h(TableCell))
    await rejects(() => h(Table, { width: 'abc%' as never }, row), '<Table width="abc%"> is not a percentage.')
    await rejects(() => h(Table, { width: '%' as never }, row), '<Table width="%"> is not a percentage.')
  })
})

describe('footnotes, images and the table of contents', () => {
  it('numbers footnotes in document order', async () => {
    const model: DocxModel = await resolveSection(() => [
      h(Paragraph, null, () => ['A', h(Footnote, null, () => 'First note')]),
      h(Table, null, () =>
        h(TableRow, null, () =>
          h(TableCell, null, () => ['B', h(Footnote, null, () => [h(Paragraph, null, () => 'Second'), 'more'])]),
        ),
      ),
    ])
    expect(model.footnotes.map((note) => note.id)).toEqual([1, 2])
    expect(model.footnotes[0]!.children[0]).toEqual({
      kind: 'paragraph',
      style: { spaceAfter: 0 },
      children: [{ kind: 'text', text: 'First note', style: {} }],
    })
    expect(model.footnotes[1]!.children).toHaveLength(2)
    expect((model.sections[0]!.children[0] as ParagraphModel).children[1]).toEqual({ kind: 'footnote', id: 1 })
  })

  it('keeps footnotes out of headers, other footnotes, and footnote tables', async () => {
    await rejects(() => h(Header, null, () => h(Footnote, null, () => 'x')), '<Footnote> works in the body only')
    await rejects(() => h(Footnote, null, () => h(Footnote)), "<Footnote> can't be inside another <Footnote>.")
    await rejects(() => h(Footnote, null, () => h(Table)), "<Table> can't be inside <Footnote>")
    await rejects(() => h(Footnote, null, () => h(List)), "<List> can't be inside <Footnote>")
  })

  it('loads SVG images with their fallback', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"/>'
    const image = (
      await first(() =>
        h(Paragraph, null, () =>
          h(Image, { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, fallback: PNG, height: 10 }),
        ),
      )
    ).children[0]
    expect(image).toMatchObject({
      kind: 'image',
      type: 'svg',
      width: 20,
      height: 10,
      fallback: { type: 'png', data: PNG },
    })
    await rejects(() => h(Image, { src: new TextEncoder().encode(svg) }), 'An SVG <Image> needs a fallback')
    await rejects(
      () => h(Image, { src: new TextEncoder().encode(svg), fallback: new TextEncoder().encode(svg) }),
      'must be a PNG',
    )
    await rejects(() => h(Image, { src: new Uint8Array([1, 2, 3]) }), 'is not a PNG, JPEG, GIF, BMP or SVG image')
    const typed = (await first(() => h(Image, { src: new Uint8Array([1, 2, 3]), type: 'png', width: 5, height: 5 })))
      .children[0]
    expect(typed).toMatchObject({ type: 'png', width: 5, height: 5 })
  })

  it('turns on updateFields for a table of contents', async () => {
    const model = await resolveSection(() => [
      h(TableOfContents, { title: 'Contents', levels: [1, 2], hyperlinks: false }),
    ])
    expect(model.sections[0]!.children[0]).toEqual({
      kind: 'toc',
      title: 'Contents',
      levels: [1, 2],
      hyperlinks: false,
    })
    expect(model.updateFields).toBe(true)
    const defaults = await resolveSection(() => h(TableOfContents))
    expect(defaults.sections[0]!.children[0]).toEqual({ kind: 'toc', levels: [1, 3], hyperlinks: true })
  })
})
