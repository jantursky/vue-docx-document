import type * as Docx from 'docx'

import { DOCX_MIME } from './mime'
import { headingStyleId, HEADING_LEVELS, TOC_TITLE } from './defaults'
import type {
  BlockModel,
  BorderModel,
  CellModel,
  DocxModel,
  HeaderFooterSet,
  ImageModel,
  InlineModel,
  ParagraphModel,
  ParagraphStyleModel,
  RunStyleModel,
  SectionModel,
  SidesModel,
  TableModel,
} from './model'
import { defined } from './styles'
import { PT_PER_IN, PX_PER_IN } from './units'

export interface WriteOptions {
  /** Pretty-print the XML inside the file, for debugging. */
  prettify?: boolean
}

export interface OutputTypes {
  blob: Blob
  uint8array: Uint8Array
  base64: string
}

export type OutputType = keyof OutputTypes

type Engine = typeof Docx

let engine: Promise<Engine> | undefined

/** `docx` loads on the first write, so a preview never pays for it. */
export const loadDocx = (): Promise<Engine> => (engine ??= import('docx'))

// Word's units: twips are 1/20 pt, font sizes half-points, border widths eighths of a point.
const twips = (pt: number): number => Math.round(pt * 20)
const halfPoints = (pt: number): number => Math.round(pt * 2)
const eighths = (pt: number): number => Math.round(pt * 8)
// Not rounded: docx turns pixels into EMUs, and a whole pixel is 3/4 pt.
const pixels = (pt: number): number => (pt * PX_PER_IN) / PT_PER_IN
const hex = (color: string): string => color.slice(1).toUpperCase()
const optional = <T, R>(value: T | undefined, map: (value: T) => R): R | undefined =>
  value === undefined ? undefined : map(value)

const ALIGNMENT = { left: 'left', center: 'center', right: 'right', justify: 'both' } as const

const PAGE_NUMBERS = { current: 'CURRENT', total: 'TOTAL_PAGES', 'section-total': 'TOTAL_PAGES_IN_SECTION' } as const

const runOptions = (style: RunStyleModel): Docx.IRunPropertiesOptions =>
  defined({
    bold: style.bold,
    italics: style.italic,
    underline: optional(style.underline, (type) => ({ type })),
    strike: style.strike,
    doubleStrike: style.doubleStrike,
    color: optional(style.color, hex),
    highlight: style.highlight,
    shading: optional(style.shading, (fill) => ({ type: 'clear' as const, color: 'auto', fill: hex(fill) })),
    font: style.font,
    size: optional(style.size, halfPoints),
    superScript: style.superscript,
    subScript: style.subscript,
    allCaps: style.allCaps,
    smallCaps: style.smallCaps,
    characterSpacing: optional(style.characterSpacing, twips),
  })

const borderOptions = (border: BorderModel): Docx.IBorderOptions => ({
  style: border.style,
  size: eighths(border.size),
  color: hex(border.color),
  space: border.space,
})

const NO_BORDER: Docx.IBorderOptions = { style: 'none', size: 0, color: 'auto' }

const SIDES = ['top', 'right', 'bottom', 'left'] as const

/** Every side written, so the ones not given have no line instead of `docx`'s thin default. */
const allSides = (sides: SidesModel<BorderModel> | 'none'): Record<(typeof SIDES)[number], Docx.IBorderOptions> =>
  Object.fromEntries(
    SIDES.map((side) => [side, sides !== 'none' && sides[side] ? borderOptions(sides[side]) : NO_BORDER]),
  ) as Record<(typeof SIDES)[number], Docx.IBorderOptions>

const paragraphOptions = (style: ParagraphStyleModel): Docx.IParagraphPropertiesOptions => {
  const spacing = defined({
    before: optional(style.spaceBefore, twips),
    after: optional(style.spaceAfter, twips),
    line: optional(style.lineHeight, (multiple) => Math.round(multiple * 240)),
    lineRule: optional(style.lineHeight, () => 'auto' as const),
  })
  return defined({
    heading: optional(style.heading, headingStyleId) as Docx.IParagraphPropertiesOptions['heading'],
    style: style.styleId,
    alignment: optional(style.align, (align) => ALIGNMENT[align]),
    spacing: Object.keys(spacing).length > 0 ? spacing : undefined,
    indent: optional(style.indent, (indent) =>
      defined({
        left: optional(indent.left, twips),
        right: optional(indent.right, twips),
        firstLine: optional(indent.firstLine, twips),
        hanging: optional(indent.hanging, twips),
      }),
    ),
    keepNext: style.keepNext,
    keepLines: style.keepLines,
    pageBreakBefore: style.pageBreakBefore,
    border: optional(style.border, (sides) =>
      Object.fromEntries(
        SIDES.flatMap((side) => {
          const line = sides[side]
          return line ? [[side, borderOptions(line)]] : []
        }),
      ),
    ),
    shading: optional(style.background, (fill) => ({ type: 'clear' as const, color: 'auto', fill: hex(fill) })),
    tabStops: style.tabStops?.map((stop) => ({ type: stop.type, position: twips(stop.position), leader: stop.leader })),
    numbering: optional(style.list, (list) => ({ reference: list.id, level: list.level })),
    run: optional(style.mark, runOptions),
  })
}

/** Builds the `docx` objects for one model; `d` is the loaded module. */
const builder = (d: Engine) => {
  const image = (model: ImageModel): Docx.ImageRun => {
    const shared = {
      transformation: { width: pixels(model.width), height: pixels(model.height) },
      altText: defined({ name: model.title ?? model.alt ?? 'Image', description: model.alt, title: model.title }),
    }
    if (model.type === 'svg') {
      if (!model.fallback) throw new Error('[vue-docx-document] An SVG image needs a fallback.')
      return new d.ImageRun({ ...shared, type: 'svg', data: model.data, fallback: model.fallback })
    }
    return new d.ImageRun({ ...shared, type: model.type, data: model.data })
  }

  const inline = (item: InlineModel): Docx.ParagraphChild => {
    switch (item.kind) {
      case 'text':
        return new d.TextRun({ text: item.text, ...runOptions(item.style) })
      case 'break':
        return new d.TextRun({ break: 1 })
      case 'tab':
        return new d.TextRun({ children: [new d.Tab()] })
      case 'pageBreak':
        return new d.PageBreak()
      case 'columnBreak':
        return new d.ColumnBreak()
      case 'pageNumber':
        return new d.TextRun({ ...runOptions(item.style), children: [d.PageNumber[PAGE_NUMBERS[item.type]]] })
      case 'image':
        return image(item)
      case 'link':
        return item.href !== undefined
          ? new d.ExternalHyperlink({ link: item.href, children: item.children.map(inline) })
          : new d.InternalHyperlink({ anchor: item.anchor ?? '', children: item.children.map(inline) })
      case 'bookmark':
        return new d.Bookmark({ id: item.id, children: item.children.map(inline) })
      case 'footnote':
        // A footnote reference takes the FootnoteReference style; docx gives it no run formatting of its own.
        return new d.FootnoteReferenceRun(item.id)
    }
  }

  const paragraph = (model: ParagraphModel): Docx.Paragraph =>
    new d.Paragraph({ ...paragraphOptions(model.style), children: model.children.map(inline) })

  const cell = (model: CellModel): Docx.TableCell => {
    // Resolve keeps tables of contents out of cells.
    const children = model.children.flatMap(block) as (Docx.Paragraph | Docx.Table)[]
    return new d.TableCell(
      defined({
        // Word can't open a cell without a paragraph.
        children: children.length > 0 ? children : [new d.Paragraph({})],
        columnSpan: model.colSpan > 1 ? model.colSpan : undefined,
        rowSpan: model.rowSpan > 1 ? model.rowSpan : undefined,
        shading: optional(model.background, (fill) => ({ type: 'clear' as const, color: 'auto', fill: hex(fill) })),
        verticalAlign: model.verticalAlign,
        width: optional(model.width, (width) => ({ size: twips(width), type: 'dxa' as const })),
        borders: optional(model.borders, allSides),
        margins: optional(model.padding, (padding) =>
          defined({
            top: optional(padding.top, twips),
            right: optional(padding.right, twips),
            bottom: optional(padding.bottom, twips),
            left: optional(padding.left, twips),
          }),
        ),
      }),
    )
  }

  const table = (model: TableModel): Docx.Table => {
    const borders: Docx.ITableBordersOptions =
      model.borders === 'none'
        ? { ...allSides('none'), insideHorizontal: NO_BORDER, insideVertical: NO_BORDER }
        : {
            ...allSides(model.borders),
            insideHorizontal: model.borders.insideH ? borderOptions(model.borders.insideH) : NO_BORDER,
            insideVertical: model.borders.insideV ? borderOptions(model.borders.insideV) : NO_BORDER,
          }
    const padding = model.cellPadding
    return new d.Table(
      defined({
        rows: model.rows.map(
          (row) =>
            new d.TableRow(
              defined({
                children: row.cells.map(cell),
                tableHeader: row.header || undefined,
                cantSplit: row.cantSplit || undefined,
                height: optional(row.height, (height) => ({ value: twips(height), rule: 'atLeast' as const })),
              }),
            ),
        ),
        width:
          model.width.unit === '%'
            ? { size: `${model.width.value}%` as const, type: 'pct' as const }
            : { size: twips(model.width.value), type: 'dxa' as const },
        columnWidths: model.columnWidths.length > 0 ? model.columnWidths.map(twips) : undefined,
        layout: model.layout === 'fixed' ? ('fixed' as const) : ('autofit' as const),
        alignment: model.align,
        borders,
        margins: optional(padding, (sides) =>
          defined({
            top: optional(sides.top, twips),
            right: optional(sides.right, twips),
            bottom: optional(sides.bottom, twips),
            left: optional(sides.left, twips),
          }),
        ),
      }),
    )
  }

  const block = (model: BlockModel): (Docx.Paragraph | Docx.Table | Docx.TableOfContents)[] => {
    switch (model.kind) {
      case 'paragraph':
        return [paragraph(model)]
      case 'table':
        return [table(model)]
      case 'toc': {
        const toc = new d.TableOfContents(model.title ?? 'Table of Contents', {
          hyperlink: model.hyperlinks,
          headingStyleRange: `${model.levels[0]}-${model.levels[1]}`,
        })
        if (model.title === undefined) return [toc]
        const title = new d.Paragraph({
          children: [new d.TextRun({ text: model.title, ...runOptions({ bold: true, size: TOC_TITLE.size }) })],
          spacing: { after: twips(TOC_TITLE.spaceAfter) },
        })
        return [title, toc]
      }
    }
  }

  const headerFooter = <T extends Docx.Header | Docx.Footer>(
    set: HeaderFooterSet,
    Kind: new (options: Docx.IHeaderOptions) => T,
  ): { default?: T; first?: T; even?: T } | undefined => {
    const entries = (['default', 'first', 'even'] as const).flatMap((type): [string, T][] => {
      const blocks = set[type]
      return blocks ? [[type, new Kind({ children: blocks.flatMap(block) as (Docx.Paragraph | Docx.Table)[] })]] : []
    })
    return entries.length > 0 ? Object.fromEntries(entries) : undefined
  }

  const section = (model: SectionModel): Docx.ISectionOptions => {
    const { page, margin } = model
    // docx takes the portrait size and swaps it for landscape.
    const landscape = page.orientation === 'landscape'
    return defined({
      properties: defined({
        page: {
          size: {
            width: twips(landscape ? page.height : page.width),
            height: twips(landscape ? page.width : page.height),
            orientation: page.orientation,
          },
          margin: {
            top: twips(margin.top),
            right: twips(margin.right),
            bottom: twips(margin.bottom),
            left: twips(margin.left),
            header: twips(margin.header),
            footer: twips(margin.footer),
            gutter: twips(margin.gutter),
          },
          pageNumbers: defined({ start: model.pageNumberStart, formatType: model.pageNumberFormat }),
        },
        titlePage: model.titlePage || undefined,
        column: optional(model.columns, (columns) => ({
          count: columns.count,
          space: twips(columns.space),
          separate: columns.separator,
          equalWidth: true,
        })),
        type: model.type,
      }),
      headers: headerFooter(model.headers, d.Header),
      footers: headerFooter(model.footers, d.Footer),
      children: model.children.flatMap(block),
    })
  }

  const styles = (model: DocxModel): Docx.IStylesOptions => {
    const { defaults } = model
    const headings = Object.fromEntries(
      HEADING_LEVELS.map((level) => {
        const { align, spaceBefore, spaceAfter, keepNext, ...run } = model.headings[level] ?? {}
        const key = level === 'title' ? 'title' : `heading${level}`
        return [
          key,
          {
            run: runOptions(run),
            paragraph: paragraphOptions({ align, spaceBefore, spaceAfter, keepNext }),
          },
        ]
      }),
    )
    const built: Docx.IStylesOptions = {
      default: {
        document: {
          run: {
            ...runOptions({ font: defaults.font, size: defaults.size, color: defaults.color }),
            ...(defaults.language ? { language: { value: defaults.language } } : {}),
          },
          paragraph: paragraphOptions({ lineHeight: defaults.lineHeight, spaceAfter: defaults.spaceAfter }),
        },
        ...headings,
      },
    }
    const raw = model.styles
    if (!raw) return built
    return { ...built, ...raw, default: { ...built.default, ...raw.default } }
  }

  const documentOf = (model: DocxModel): Docx.Document => {
    const { meta } = model
    return new d.Document(
      defined({
        ...meta,
        // docx writes "Un-named" otherwise.
        creator: meta.creator ?? '',
        lastModifiedBy: meta.lastModifiedBy ?? meta.creator ?? '',
        styles: styles(model),
        numbering: {
          config: model.lists.map((list) => ({
            reference: list.id,
            levels: list.levels.map((level, index) => ({
              level: index,
              format: level.format,
              text: level.text,
              start: level.start,
              isLegalNumberingStyle: list.legal,
              alignment: 'left' as const,
              style: { paragraph: { indent: { left: twips(level.indent), hanging: twips(level.hanging) } } },
            })),
          })),
        },
        footnotes: Object.fromEntries(
          model.footnotes.map((note) => [note.id, { children: note.children.map(paragraph) }]),
        ),
        features: model.updateFields ? { updateFields: true } : undefined,
        evenAndOddHeaderAndFooters: model.evenAndOddHeaders || undefined,
        sections: model.sections.map(section),
      }),
    )
  }

  return documentOf
}

/** Builds the `docx` Document for a model. Loads `docx` on first use. */
export const toDocx = async (model: DocxModel): Promise<Docx.Document> => builder(await loadDocx())(model)

/** Writes a model to a .docx file in the given form. */
export const writeModel = async <T extends OutputType>(
  model: DocxModel,
  output: T,
  options: WriteOptions = {},
): Promise<OutputTypes[T]> => {
  const { Packer } = await loadDocx()
  const document = await toDocx(model)
  const prettify = options.prettify ?? false
  if (output === 'base64') return (await Packer.pack(document, 'base64', prettify)) as OutputTypes[T]
  const bytes = await Packer.pack(document, 'uint8array', prettify)
  if (output === 'blob') return new Blob([bytes as BlobPart], { type: DOCX_MIME }) as OutputTypes[T]
  return bytes as OutputTypes[T]
}
