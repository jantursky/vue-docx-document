import { describe, expect, it } from 'vitest'
import { h, type VNodeChild } from 'vue'

import {
  Bookmark,
  Break,
  ColumnBreak,
  DOCX_MIME,
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
  Tab,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  createDocx,
  renderToBase64,
  renderToBlob,
  renderToBuffer,
  renderToModel,
  toDocx,
  writeModel,
} from '../../src'
import Report from '../fixtures/Report.vue'
import { fileNames, PNG, singleSection, texts, unzip } from '../fixtures'

const write = async (children: () => VNodeChild, sectionProps = {}, documentProps = {}) =>
  unzip(await renderToBuffer(singleSection(children, sectionProps, documentProps)))

const documentXml = async (children: () => VNodeChild, sectionProps = {}, documentProps = {}) =>
  (await write(children, sectionProps, documentProps))['word/document.xml']!

describe('the file', () => {
  it('is a zip with the document, metadata and no engine defaults', async () => {
    const bytes = await renderToBuffer(Report, { title: 'Quarterly', points: ['One', 'Two'] })
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b])
    const parts = await unzip(bytes)
    expect(texts(parts['word/document.xml']!)).toEqual(['Quarterly', 'One', ' ', 'matters', 'Two', ' ', 'matters'])
    expect(parts['docProps/core.xml']).toContain('<dc:title>Quarterly</dc:title>')
    expect(parts['docProps/core.xml']).toContain('<dc:creator>Ada</dc:creator>')
    expect(parts['docProps/core.xml']).toContain('<cp:lastModifiedBy>Ada</cp:lastModifiedBy>')
    expect(parts['docProps/core.xml']).not.toContain('Un-named')
  })

  it('writes every document property', async () => {
    const parts = await write(
      () => 'x',
      {},
      {
        subject: 'S',
        description: 'D',
        keywords: 'k1, k2',
        lastModifiedBy: 'Bob',
        revision: 4,
      },
    )
    const core = parts['docProps/core.xml']!
    expect(core).toContain('<dc:subject>S</dc:subject>')
    expect(core).toContain('<dc:description>D</dc:description>')
    expect(core).toContain('<cp:keywords>k1, k2</cp:keywords>')
    expect(core).toContain('<cp:lastModifiedBy>Bob</cp:lastModifiedBy>')
    expect(core).toContain('<cp:revision>4</cp:revision>')
    expect(core).not.toContain('<dc:creator>Un-named')
  })

  it('writes Blob, base64 and pretty XML', async () => {
    const Doc = singleSection(() => 'x')
    const blob = await renderToBlob(Doc)
    expect(blob.type).toBe(DOCX_MIME)
    const base64 = await renderToBase64(Doc)
    expect(atob(base64).slice(0, 2)).toBe('PK')
    const model = await renderToModel(Doc)
    const pretty = await unzip(await writeModel(model, 'uint8array', { prettify: true }))
    expect(pretty['word/document.xml']).toMatch(/\n\s+<w:body>/)
    expect((await writeModel(model, 'blob')).size).toBeGreaterThan(1000)
    expect((await toDocx(model)).constructor.name).toBe('File')
  })
})

describe('styles', () => {
  it('writes document defaults, the language and heading styles', async () => {
    const parts = await write(
      () => 'x',
      {},
      {
        font: 'Georgia',
        fontSize: 12,
        color: '#333',
        lineHeight: 1.5,
        spaceAfter: 10,
        language: 'sk-SK',
        headings: { 1: { size: 20, bold: true, color: 'black', align: 'center' } },
      },
    )
    const styles = parts['word/styles.xml']!
    const defaults = /<w:docDefaults>[\s\S]*<\/w:docDefaults>/.exec(styles)![0]
    expect(defaults).toContain('w:ascii="Georgia"')
    expect(defaults).toContain('<w:sz w:val="24"/>')
    expect(defaults).toContain('<w:color w:val="333333"/>')
    expect(defaults).toContain('<w:lang w:val="sk-SK"/>')
    expect(defaults).toContain('<w:spacing w:after="200" w:line="360" w:lineRule="auto"/>')
    const heading1 = /<w:style w:type="paragraph" w:styleId="Heading1">[\s\S]*?<\/w:style>/.exec(styles)![0]
    expect(heading1).toContain('<w:jc w:val="center"/>')
    expect(heading1).toContain('<w:keepNext/>')
    expect(heading1).toContain('<w:b/>')
    expect(heading1).toContain('<w:sz w:val="40"/>')
    expect(heading1).toContain('<w:color w:val="000000"/>')
  })

  it('merges raw docx styles after its own', async () => {
    const styles = (
      await write(
        () => h(Paragraph, { styleId: 'Quote' }, () => 'x'),
        {},
        {
          styles: {
            default: { heading2: { run: { size: 50 } } },
            paragraphStyles: [{ id: 'Quote', name: 'Quote', run: { italics: true } }],
          },
        },
      )
    )['word/styles.xml']!
    expect(styles).toMatch(/w:styleId="Quote">[\s\S]*?<w:i\/>/)
    expect(/w:styleId="Heading2">[\s\S]*?<\/w:style>/.exec(styles)![0]).toContain('<w:sz w:val="50"/>')
    expect(styles).toMatch(/w:styleId="Heading1">[\s\S]*?<w:sz w:val="32"\/>/)
  })
})

describe('paragraphs and runs', () => {
  it('writes paragraph formatting', async () => {
    const xml = await documentXml(() =>
      h(
        Paragraph,
        {
          heading: 3,
          align: 'justify',
          spaceBefore: 6,
          spaceAfter: 3,
          lineHeight: 2,
          indent: 36,
          indentRight: 18,
          hanging: 9,
          keepNext: true,
          keepLines: true,
          pageBreakBefore: true,
          border: { bottom: { style: 'dashed', size: 1, color: 'red', space: 1 } },
          background: '#eeeeee',
          tabStops: [{ position: '3in', type: 'right', leader: 'dot' }],
        },
        () => 'Para',
      ),
    )
    expect(xml).toContain('<w:pStyle w:val="Heading3"/>')
    expect(xml).toContain('<w:jc w:val="both"/>')
    expect(xml).toContain('<w:spacing w:after="60" w:before="120" w:line="480" w:lineRule="auto"/>')
    expect(xml).toContain('<w:ind w:left="720" w:right="360" w:hanging="180"/>')
    expect(xml).toContain('<w:keepNext/>')
    expect(xml).toContain('<w:keepLines/>')
    expect(xml).toContain('<w:pageBreakBefore/>')
    expect(xml).toContain('<w:bottom w:val="dashed" w:color="FF0000" w:sz="8" w:space="1"/>')
    expect(xml).toContain('w:fill="EEEEEE"')
    expect(xml).toContain('<w:tab w:val="right" w:pos="4320" w:leader="dot"/>')
  })

  it('writes run formatting', async () => {
    const xml = await documentXml(() =>
      h(Paragraph, null, () => [
        h(TextRun, {
          bold: true,
          italic: true,
          underline: 'double',
          strike: true,
          color: 'teal',
          highlight: 'yellow',
          shading: 'silver',
          font: 'Courier New',
          size: 9,
          superscript: true,
          smallCaps: true,
          characterSpacing: 1,
          text: 'Run',
        }),
        h(TextRun, { doubleStrike: true, subscript: true, allCaps: true }, () => 'Sub'),
      ]),
    )
    for (const tag of [
      '<w:b/>',
      '<w:i/>',
      '<w:u w:val="double"/>',
      '<w:strike/>',
      '<w:color w:val="008080"/>',
      '<w:highlight w:val="yellow"/>',
      'w:fill="C0C0C0"',
      'w:ascii="Courier New"',
      '<w:sz w:val="18"/>',
      '<w:vertAlign w:val="superscript"/>',
      '<w:caps/>',
      '<w:smallCaps/>',
      '<w:spacing w:val="20"/>',
      '<w:dstrike/>',
      '<w:vertAlign w:val="subscript"/>',
    ]) {
      expect(xml).toContain(tag)
    }
  })

  it('writes breaks, tabs, fields, links, bookmarks and footnotes', async () => {
    const parts = await write(() =>
      h(Paragraph, null, () => [
        'A',
        h(Break),
        'B',
        h(Tab),
        h(ColumnBreak),
        h(PageBreak),
        h(PageNumber),
        h(PageNumber, { type: 'total' }),
        h(PageNumber, { type: 'section-total' }),
        h(Link, { href: 'https://vuejs.org' }, () => 'Vue'),
        h(Bookmark, { id: 'target' }, () => 'Target'),
        h(Link, { anchor: 'target' }, () => 'Jump'),
        h(Footnote, null, () => 'A note'),
      ]),
    )
    const xml = parts['word/document.xml']!
    expect(xml).toContain('<w:br/>')
    expect(xml).toContain('<w:tab/>')
    expect(xml).toContain('<w:br w:type="column"/>')
    expect(xml).toContain('<w:br w:type="page"/>')
    expect(xml).toContain('PAGE')
    expect(xml).toContain('NUMPAGES')
    expect(xml).toContain('SECTIONPAGES')
    expect(xml).toMatch(/<w:hyperlink [^>]*r:id="[^"]+"/)
    expect(parts['word/_rels/document.xml.rels']).toContain('Target="https://vuejs.org"')
    expect(xml).toContain('<w:bookmarkStart w:name="target"')
    expect(xml).toContain('w:anchor="target"')
    expect(xml).toContain('<w:footnoteReference w:id="1"/>')
    expect(texts(parts['word/footnotes.xml']!)).toContain('A note')
  })

  it('writes line feeds as breaks and keeps spaces inside links', async () => {
    const parts = await write(() =>
      h(Paragraph, null, () => ['One\nTwo see', h(Link, { href: 'https://a.b' }, () => ' docs '), 'now']),
    )
    const xml = parts['word/document.xml']!
    expect(xml).toMatch(
      /<w:t xml:space="preserve">One<\/w:t><\/w:r><w:r><w:br\/><\/w:r><w:r><w:t xml:space="preserve">Two see<\/w:t>/,
    )
    expect(texts(xml)).toEqual(['One', 'Two see', ' docs ', 'now'])
  })

  it('keeps an empty paragraph with its mark formatting', async () => {
    const xml = await documentXml(() => [h(Paragraph, { size: 20 }), 'After'])
    expect(xml).toMatch(/<w:p><w:pPr><w:rPr><w:sz w:val="40"\/><w:szCs w:val="40"\/><\/w:rPr><\/w:pPr><\/w:p>/)
  })
})

describe('lists', () => {
  it('writes one numbering definition per list', async () => {
    const parts = await write(() => [
      h(List, { ordered: true, start: 4, format: 'upperLetter' }, () => [
        h(ListItem, null, () => ['One', h(List, null, () => h(ListItem, null, () => 'Nested'))]),
      ]),
      h(List, { bullet: '→' }, () => h(ListItem, null, () => 'Arrow')),
    ])
    const numbering = parts['word/numbering.xml']!
    expect(numbering).toMatch(/<w:start w:val="4"\/><w:numFmt w:val="upperLetter"\/><w:lvlText w:val="%1."\/>/)
    expect(numbering).toContain('<w:lvlText w:val="◦"/>')
    expect(numbering).toContain('<w:lvlText w:val="→"/>')
    expect(numbering).toContain('<w:ind w:left="1440" w:hanging="360"/>')
    const xml = parts['word/document.xml']!
    const numIds = [...xml.matchAll(/<w:ilvl w:val="(\d)"\/><w:numId w:val="(\d+)"\/>/g)].map(([, level, id]) => [
      level,
      id,
    ])
    expect(numIds).toHaveLength(3)
    expect(numIds[0]![1]).toBe(numIds[1]![1])
    expect(numIds[1]![0]).toBe('1')
    expect(numIds[2]![1]).not.toBe(numIds[0]![1])
  })

  it('writes legal numbering and numbered headings', async () => {
    const parts = await write(() =>
      h(List, { legal: true }, () =>
        h(ListItem, { heading: 1 }, () => ['Definitions', h(List, null, () => h(ListItem, null, () => 'Terms'))]),
      ),
    )
    const numbering = parts['word/numbering.xml']!
    // docx adds a bullet definition of its own first.
    const levelTexts = [...numbering.matchAll(/<w:lvlText w:val="(%[^"]*)"\/>/g)].map(([, text]) => text)
    expect(levelTexts.slice(0, 3)).toEqual(['%1.', '%1.%2.', '%1.%2.%3.'])
    expect(numbering).toContain('<w:isLgl/>')
    expect(numbering.match(/<w:numFmt w:val="decimal"\/>/g)).toHaveLength(9)
    const xml = parts['word/document.xml']!
    expect(xml).toMatch(
      /<w:pPr><w:pStyle w:val="Heading1"\/><w:numPr><w:ilvl w:val="0"\/><w:numId w:val="\d+"\/><\/w:numPr>/,
    )
  })
})

describe('tables', () => {
  it('writes widths, spans, header rows, borders and shading', async () => {
    const xml = await documentXml(() =>
      h(
        Table,
        {
          columnWidths: [100, 200],
          width: 300,
          align: 'center',
          cellPadding: { left: 3 },
          borders: { top: { size: 1 } },
        },
        () => [
          h(TableRow, { header: true, cantSplit: true, height: 24 }, () =>
            h(TableCell, { colSpan: 2, background: 'navy' }, () => 'Head'),
          ),
          h(TableRow, null, () => [
            h(
              TableCell,
              { rowSpan: 2, verticalAlign: 'bottom', width: 100, borders: 'none', padding: 2 },
              () => 'Tall',
            ),
            h(TableCell, { borders: { left: { color: 'red' } } }),
          ]),
          h(TableRow, null, () => h(TableCell, null, () => 'Last')),
        ],
      ),
    )
    expect(xml).toContain('<w:tblW w:type="dxa" w:w="6000"/>')
    expect(xml).toContain('<w:jc w:val="center"/>')
    expect(xml).toContain('<w:tblLayout w:type="fixed"/>')
    expect(xml).toContain('<w:gridCol w:w="2000"/><w:gridCol w:w="4000"/>')
    expect(xml).toContain('<w:top w:val="single" w:color="000000" w:sz="8" w:space="0"/>')
    expect(xml).toContain('<w:bottom w:val="none" w:color="auto" w:sz="0"/>')
    expect(xml).toMatch(/<w:tblCellMar>[\s\S]*<w:left w:type="dxa" w:w="60"\/>/)
    expect(xml).toContain('<w:tblHeader/>')
    expect(xml).toContain('<w:cantSplit/>')
    expect(xml).toContain('<w:trHeight w:val="480" w:hRule="atLeast"/>')
    expect(xml).toContain('<w:gridSpan w:val="2"/>')
    expect(xml).toContain('w:fill="000080"')
    expect(xml).toContain('<w:vMerge w:val="restart"/>')
    expect(xml).toContain('<w:vMerge w:val="continue"/>')
    expect(xml).toContain('<w:vAlign w:val="bottom"/>')
    expect(xml).toContain('<w:tcW w:type="dxa" w:w="2000"/>')
    expect(xml).toContain('<w:left w:val="single" w:color="FF0000" w:sz="4" w:space="0"/>')
    // An empty cell still gets a paragraph.
    expect(xml).toMatch(/<w:tc><w:tcPr>(?:(?!<\/w:tc>).)*<w:p\/?>/)
  })

  it('cascades run props set on a row into its runs', async () => {
    const xml = await documentXml(() =>
      h(Table, null, () => h(TableRow, { size: 9, italic: true }, () => h(TableCell, null, () => 'Caption'))),
    )
    expect(xml).toMatch(
      /<w:r><w:rPr><w:i\/><w:iCs\/><w:sz w:val="18"\/><w:szCs w:val="18"\/><\/w:rPr><w:t xml:space="preserve">Caption<\/w:t>/,
    )
  })

  it('writes a borderless percent table', async () => {
    const xml = await documentXml(() =>
      h(Table, { borders: 'none', width: '50%' }, () => h(TableRow, null, () => h(TableCell, null, () => 'x'))),
    )
    expect(xml).toContain('<w:tblW w:type="pct" w:w="50%"/>')
    expect(xml).toContain('<w:insideH w:val="none" w:color="auto" w:sz="0"/>')
    expect(xml).toContain('<w:tblLayout w:type="autofit"/>')
  })
})

describe('sections', () => {
  it('writes page setup, columns, numbering and headers', async () => {
    const parts = await write(
      () => [
        h(Header, null, () => 'Every page'),
        h(Header, { type: 'first' }, () => 'Cover'),
        h(Footer, { type: 'even' }, () =>
          h(Table, null, () => h(TableRow, null, () => h(TableCell, null, () => 'Even'))),
        ),
        'Body',
      ],
      {
        size: 'Letter',
        orientation: 'landscape',
        margin: { top: 36, gutter: 9 },
        columns: { count: 2, space: 18, separator: true },
        type: 'continuous',
        pageNumberStart: 3,
        pageNumberFormat: 'lowerRoman',
      },
    )
    const xml = parts['word/document.xml']!
    expect(xml).toContain('<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>')
    expect(xml).toContain(
      '<w:pgMar w:top="720" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="180"/>',
    )
    expect(xml).toContain('<w:cols w:space="360" w:num="2" w:sep="true" w:equalWidth="true"/>')
    expect(xml).toContain('<w:type w:val="continuous"/>')
    expect(xml).toContain('<w:pgNumType w:start="3" w:fmt="lowerRoman"/>')
    expect(xml).toContain('<w:titlePg/>')
    expect(xml).toContain('<w:headerReference w:type="default"')
    expect(xml).toContain('<w:headerReference w:type="first"')
    expect(xml).toContain('<w:footerReference w:type="even"')
    expect(parts['word/settings.xml']).toContain('<w:evenAndOddHeaders/>')
    const headers = Object.entries(parts).filter(([name]) => /^word\/header\d+\.xml$/.test(name))
    expect(headers.map(([, part]) => texts(part)[0]).sort()).toEqual(['Cover', 'Every page'])
    expect(
      Object.entries(parts).some(([name, part]) => name.startsWith('word/footer') && part.includes('<w:tbl>')),
    ).toBe(true)
  })

  it('writes a table of contents that Word fills on open', async () => {
    const parts = await write(() => [
      h(TableOfContents, { title: 'Contents', levels: [1, 2] }),
      h(Paragraph, { heading: 1 }, () => 'Intro'),
    ])
    const xml = parts['word/document.xml']!
    expect(texts(xml)[0]).toBe('Contents')
    expect(xml).toContain('TOC \\h \\o &quot;1-2&quot;')
    expect(parts['word/settings.xml']).toContain('<w:updateFields/>')
    const plain = (await write(() => h(TableOfContents, { hyperlinks: false })))['word/document.xml']!
    expect(plain).toContain('TOC \\o &quot;1-3&quot;')
  })
})

describe('images', () => {
  it('embeds rasters at their size and SVG with a fallback', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')
    const bytes = await renderToBuffer(
      singleSection(() => [
        h(Image, { src: PNG, width: 72, alt: 'Logo' }),
        h(Paragraph, null, () => h(Image, { src: svg, fallback: PNG, title: 'Vector' })),
      ]),
    )
    const parts = await unzip(bytes)
    const xml = parts['word/document.xml']!
    // 72pt is 96px, and docx writes EMUs: 914400 per inch.
    expect(xml).toContain('<wp:extent cx="914400" cy="457200"/>')
    expect(xml).toContain('descr="Logo"')
    expect(xml).toContain('title="Vector"')
    expect(xml).toContain('asvg:svgBlip')
    const media = (await fileNames(bytes)).filter((name) => name.startsWith('word/media/'))
    expect(media.some((name) => name.endsWith('.png'))).toBe(true)
    expect(media.some((name) => name.endsWith('.svg'))).toBe(true)
  })

  it('writes exact extents for sizes that are not whole pixels', async () => {
    const xml = await documentXml(() => h(Image, { src: PNG, width: 100 }))
    // 100pt is 1270000 EMUs (12700 per point); rounding to 133px first would give 1266825.
    expect(xml).toContain('<wp:extent cx="1270000" cy="635000"/>')
  })

  it('refuses an SVG model without a fallback', async () => {
    const model = await renderToModel(singleSection(() => h(Image, { src: PNG })))
    const image = (model.sections[0]!.children[0] as { children: { type: string }[] }).children[0]!
    image.type = 'svg'
    await expect(writeModel(model, 'uint8array')).rejects.toThrow('An SVG image needs a fallback.')
  })
})

describe('createDocx', () => {
  it('hands out the docx Document for anything the components miss', async () => {
    const instance = createDocx(singleSection(() => 'x'))
    const document = await instance.toDocx()
    expect(document.Document).toBeDefined()
    instance.unmount()
  })
})
