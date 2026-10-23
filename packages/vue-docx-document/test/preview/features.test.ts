import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type VNodeChild } from 'vue'

import {
  Bookmark,
  Break,
  ColumnBreak,
  Document,
  DocxPreview,
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
} from '../../src'
import { runCss } from '../../src/preview/render'
import { PNG, singleSection } from '../fixtures'

const wrappers: VueWrapper[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

const until = (condition: () => boolean) =>
  vi.waitFor(() => {
    if (!condition()) throw new Error('not yet')
  })

const preview = async (document: ReturnType<typeof defineComponent>, props: Record<string, unknown> = {}) => {
  const wrapper = mount(DocxPreview, { props: { document, debounce: 0, ...props } })
  wrappers.push(wrapper)
  await until(() => wrapper.find('[data-docx-page]').exists() || wrapper.find('[role="alert"]').exists())
  return wrapper
}

const draw = (children: () => VNodeChild, sectionProps = {}, documentProps = {}) =>
  preview(singleSection(children, sectionProps, documentProps))

describe('pages', () => {
  it('takes first and even headers, fills page numbers and inherits headers', async () => {
    const wrapper = await preview(
      defineComponent(
        () => () =>
          h(Document, { language: 'en-GB' }, () => [
            h(Section, { pageNumberFormat: 'upperRoman' }, () => [
              h(Header, null, () => ['Default ', h(PageNumber), ' of ', h(PageNumber, { type: 'total' })]),
              h(Header, { type: 'first' }, () => 'Cover'),
              h(Header, { type: 'even' }, () => ['Even ', h(PageNumber, { type: 'section-total' })]),
              'One',
              h(PageBreak),
              'Two',
              h(Paragraph, null, () => ['Three', h(PageBreak)]),
              'Four',
            ]),
            h(Section, { size: 'Letter', orientation: 'landscape', pageNumberStart: 1 }, () => [
              h(Footer, null, () => 'Second footer'),
              'Five',
            ]),
          ]),
      ),
    )
    const pages = wrapper.findAll('[data-docx-page]')
    expect(wrapper.attributes('lang')).toBe('en-GB')
    expect(
      pages.map((page) => (page.find('[data-docx-header]').exists() ? page.find('[data-docx-header]').text() : '')),
    ).toEqual([
      'Cover',
      'Even 3',
      'Default III of 4',
      // The second section restarts at 1, an odd page, and inherits the default header.
      'Default 1 of 4',
    ])
    expect(pages.map((page) => page.find('[data-docx-body]').text())).toEqual(['One', 'TwoThree', 'Four', 'Five'])
    expect(pages[3]!.attributes('style')).toContain('width: 792pt')
    expect(pages[3]!.find('[data-docx-footer]').text()).toBe('Second footer')
    expect(pages[3]!.attributes('data-docx-page')).toBe('1')
  })

  it('puts footnotes at the bottom of their page and lays out columns', async () => {
    const wrapper = await draw(
      () => [
        h(Paragraph, { bold: true, color: 'red' }, () => ['Claim\nmade', h(Footnote, null, () => 'Source')]),
        h(ColumnBreak),
      ],
      { columns: { count: 2, separator: true } },
    )
    // Word draws the marker in its FootnoteReference style only, so the paragraph's bold and red don't reach it.
    const marker = wrapper.find('[data-docx-footnote-ref]')
    expect(marker.element.tagName).toBe('SUP')
    expect(marker.text()).toBe('1')
    expect(marker.attributes('style')).toBe('font-size: 65%; line-height: 0;')
    expect(wrapper.find('[data-docx-region] p').html()).toContain('Claim</span><br><span')
    expect(wrapper.find('[data-docx-footnotes]').text()).toBe('1 Source')
    expect(wrapper.find('[data-docx-region]').attributes('style')).toContain('column-count: 2')
  })
})

describe('blocks', () => {
  it('draws list markers that count per list and level', async () => {
    const wrapper = await draw(() => [
      h(List, { ordered: true, start: 2 }, () => [
        h(ListItem, null, () => 'A'),
        h(ListItem, null, () => [
          'B',
          h(List, { ordered: true }, () => [h(ListItem, null, () => 'B1'), h(ListItem, null, () => 'B2')]),
        ]),
        h(ListItem, null, () => 'C'),
      ]),
      h(List, null, () => [h(ListItem, null, () => 'Dot')]),
    ])
    expect(wrapper.findAll('[data-docx-list-marker]').map((marker) => marker.text())).toEqual([
      '2.',
      '3.',
      'a.',
      'b.',
      '4.',
      '•',
    ])
  })

  it('draws tables with spans, padding, borders and widths', async () => {
    const wrapper = await draw(() =>
      h(Table, { columnWidths: [100, 100], align: 'center', borders: { insideV: { color: 'red' } } }, () => [
        h(TableRow, { header: true, height: 30 }, () =>
          h(TableCell, { colSpan: 2, background: 'yellow' }, () => 'Head'),
        ),
        h(TableRow, null, () => [
          h(TableCell, { rowSpan: 2, verticalAlign: 'center', borders: 'none' }, () => 'Tall'),
          h(TableCell, { padding: 4, borders: { bottom: { style: 'double' } } }, () => 'Right'),
        ]),
        h(TableRow, null, () =>
          h(TableCell, { width: 100 }, () =>
            h(Table, { width: '50%', borders: 'none' }, () =>
              h(TableRow, null, () => h(TableCell, null, () => 'Inner')),
            ),
          ),
        ),
      ]),
    )
    const table = wrapper.find('[data-docx-table]')
    expect(table.attributes('style')).toContain('table-layout: fixed')
    expect(table.attributes('style')).toContain('margin-left: auto')
    expect(table.findAll('col')).toHaveLength(2)
    const cells = table.findAll('td')
    expect(cells[0]!.attributes('colspan')).toBe('2')
    expect(cells[0]!.attributes('style')).toContain('background-color: #ffff00')
    expect(cells[1]!.attributes('rowspan')).toBe('2')
    expect(cells[1]!.attributes('style')).toContain('vertical-align: middle')
    expect(cells[1]!.attributes('style')).toContain('border-style: none')
    expect(cells[2]!.attributes('style')).toContain('padding: 4pt')
    expect(cells[2]!.attributes('style')).toContain('double')
    expect(cells[2]!.attributes('style')).toContain('#ff0000')
    expect(wrapper.find('[data-docx-header-row]').attributes('style')).toContain('height: 30pt')
    expect(wrapper.text()).toContain('Inner')
  })

  it('draws images from object URLs and revokes them when the document changes', async () => {
    const src = ref<string | Uint8Array>(PNG)
    const created = vi.spyOn(URL, 'createObjectURL')
    const revoked = vi.spyOn(URL, 'revokeObjectURL')
    const Doc = defineComponent(
      () => () =>
        h(Document, null, () => h(Section, null, () => h(Image, { src: src.value, alt: 'Logo', height: 30 }))),
    )
    const wrapper = await preview(Doc)
    const image = wrapper.find('img')
    expect(image.attributes('alt')).toBe('Logo')
    expect(image.attributes('style')).toContain('width: 60pt')
    const url = image.attributes('src')!
    expect(created).toHaveBeenCalled()
    src.value = PNG.slice()
    await until(() => wrapper.find('img').attributes('src') !== url)
    expect(revoked).toHaveBeenCalledWith(url)
  })

  it('lists headings in a table of contents with their pages', async () => {
    const wrapper = await draw(() => [
      h(TableOfContents, { title: 'Contents' }),
      h(Paragraph, { heading: 1 }, () => 'Intro'),
      h(PageBreak),
      h(Paragraph, { heading: 2 }, () => ['Details ', h(Link, { href: 'https://x.y' }, () => 'linked')]),
      h(Paragraph, { heading: 4 }, () => 'Too deep'),
    ])
    const entries = wrapper.findAll('[data-docx-toc-entry]')
    expect(entries.map((entry) => entry.text())).toEqual(['Intro1', 'Details linked2'])
    const target = entries[0]!.find('a').attributes('href')!.slice(1)
    expect(wrapper.find(`[id="${target}"]`).text()).toBe('Intro')
    const plain = await draw(() => h(TableOfContents, { hyperlinks: false }))
    expect(plain.text()).toContain('No table of contents entries found.')
  })
})

describe('text', () => {
  it('draws runs, links, bookmarks, breaks and tab stops', async () => {
    const wrapper = await draw(() => [
      h(
        Paragraph,
        { tabStops: [{ position: 300, type: 'right' }, { position: 100, type: 'center' }, { position: 50 }] },
        () => ['Item', h(Tab), 'Price', h(Tab), 'Mid', h(Tab), 'Left', h(Tab), 'Overflow'],
      ),
      h(Paragraph, null, () => ['a', h(Tab), 'b', h(Break), h(TextRun, { bold: true }, () => 'Bold')]),
      h(Paragraph, null, () => [
        h(Link, { href: 'https://vuejs.org' }, () => 'Vue'),
        h(Link, { anchor: 'mark' }, () => 'Jump'),
        h(Bookmark, { id: 'mark' }, () => 'Here'),
      ]),
      h(Paragraph, { size: 30 }),
    ])
    const stops = wrapper.findAll('[data-docx-tab-stop]')
    expect(stops.map((stop) => stop.attributes('style'))).toEqual([
      expect.stringContaining('right: 151.276pt'),
      expect.stringContaining('translateX(-50%)'),
      expect.stringContaining('left: 50pt'),
    ])
    expect(wrapper.text()).toContain('Overflow')
    expect(wrapper.find('br').exists()).toBe(true)
    const links = wrapper.findAll('a')
    expect(links[0]!.attributes()).toMatchObject({
      href: 'https://vuejs.org',
      rel: 'noopener noreferrer',
      target: '_blank',
    })
    const bookmark = wrapper.find('[data-docx-bookmark="mark"]')
    expect(links[1]!.attributes('href')).toBe(`#${bookmark.attributes('id')}`)
    const empty = wrapper.findAll('[data-docx-paragraph]').at(-1)!
    expect(empty.attributes('style')).toContain('font-size: 30pt')
  })

  it('maps run styles to CSS', () => {
    expect(
      runCss({
        bold: false,
        italic: true,
        underline: 'thick',
        strike: true,
        color: '#ff0000',
        highlight: 'darkBlue',
        font: 'Arial',
        size: 10,
        subscript: true,
        allCaps: true,
        smallCaps: true,
        characterSpacing: 1,
      }),
    ).toEqual({
      fontWeight: 400,
      fontStyle: 'italic',
      textDecorationLine: 'underline line-through',
      textDecorationThickness: '0.15em',
      color: '#ff0000',
      backgroundColor: '#000080',
      fontFamily: '"Arial", sans-serif',
      fontSize: '6.5pt',
      verticalAlign: 'sub',
      lineHeight: 0,
      textTransform: 'uppercase',
      fontVariant: 'small-caps',
      letterSpacing: '1pt',
    })
    expect(runCss({ doubleStrike: true, superscript: true, shading: '#eeeeee', underline: 'wave' })).toMatchObject({
      textDecorationStyle: 'double',
      fontSize: '65%',
      backgroundColor: '#eeeeee',
    })
    expect(runCss({ underline: 'dash' }).textDecorationStyle).toBe('dashed')
  })
})
