import { h, type CSSProperties, type VNode, type VNodeChild } from 'vue'

import type { BorderStyle, HighlightColor } from '../components/types'
import { CELL_PADDING, FOOTNOTE_SIZE, TOC_TITLE } from '../core/defaults'
import type {
  BlockModel,
  BorderModel,
  CellModel,
  DocxModel,
  ImageModel,
  InlineModel,
  ParagraphModel,
  RunStyleModel,
  SidesModel,
  TableModel,
  TocModel,
} from '../core/model'
import { round } from '../core/units'
import type { Flow } from './flow'
import { FOOTNOTE_SEPARATOR } from './paginate'
import { at } from './at'

export interface RenderContext {
  model: DocxModel
  flow: Flow
  /** An object URL for an image's bytes. */
  image: (image: ImageModel) => string
  /** Prefix for element ids, so two previews on a page don't clash. */
  id: string
  /** The width of the text column, in points, for tab stops. */
  width: number
  /** Field values on the page being drawn; unset while measuring. */
  page?: { number: string; total: number; sectionTotal: number }
  /** The page each heading landed on, for a table of contents. */
  headingPages?: Map<string, string>
}

export const pt = (value: number): string => `${round(value)}pt`

/** Word's single line spacing is the font's own line height, about 1.2em for common fonts. */
export const LINE = 1.2

export const fontFamily = (font: string): string => `"${font}", sans-serif`

const HIGHLIGHTS: Record<HighlightColor, string> = {
  yellow: '#ffff00',
  green: '#00ff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  blue: '#0000ff',
  red: '#ff0000',
  darkBlue: '#000080',
  darkCyan: '#008080',
  darkGreen: '#008000',
  darkMagenta: '#800080',
  darkRed: '#800000',
  darkYellow: '#808000',
  darkGray: '#808080',
  lightGray: '#c0c0c0',
  black: '#000000',
  white: '#ffffff',
}

const UNDERLINES: Partial<Record<string, string>> = { double: 'double', dotted: 'dotted', dash: 'dashed', wave: 'wavy' }

export const runCss = (style: RunStyleModel): CSSProperties => {
  const css: CSSProperties = {}
  if (style.bold !== undefined) css.fontWeight = style.bold ? 700 : 400
  if (style.italic !== undefined) css.fontStyle = style.italic ? 'italic' : 'normal'
  const lines = [
    style.underline && 'underline',
    (style.strike === true || style.doubleStrike === true) && 'line-through',
  ].filter(Boolean)
  if (lines.length > 0) {
    css.textDecorationLine = lines.join(' ')
    const decoration = style.doubleStrike ? 'double' : style.underline && UNDERLINES[style.underline]
    if (decoration) css.textDecorationStyle = decoration as CSSProperties['textDecorationStyle']
    if (style.underline === 'thick') css.textDecorationThickness = '0.15em'
  }
  if (style.color) css.color = style.color
  const background = style.highlight ? HIGHLIGHTS[style.highlight] : style.shading
  if (background) css.backgroundColor = background
  if (style.font) css.fontFamily = fontFamily(style.font)
  if (style.size !== undefined) css.fontSize = pt(style.size)
  if (style.superscript || style.subscript) {
    css.verticalAlign = style.superscript ? 'super' : 'sub'
    css.fontSize = style.size === undefined ? '65%' : pt(style.size * 0.65)
    css.lineHeight = 0
  }
  if (style.allCaps) css.textTransform = 'uppercase'
  if (style.smallCaps) css.fontVariant = 'small-caps'
  if (style.characterSpacing !== undefined) css.letterSpacing = pt(style.characterSpacing)
  return css
}

const BORDER_STYLES: Record<BorderStyle, string> = {
  single: 'solid',
  thick: 'solid',
  double: 'double',
  dotted: 'dotted',
  dashed: 'dashed',
  none: 'none',
}

export const borderCss = (border: BorderModel | undefined): string => {
  if (!border || border.style === 'none') return 'none'
  // A double line needs room for two strokes and the gap.
  const width = border.style === 'double' ? Math.max(border.size * 3, 2.25) : border.size
  return `${pt(width)} ${BORDER_STYLES[border.style]} ${border.color}`
}

const renderImage = (image: ImageModel, ctx: RenderContext): VNode =>
  h('img', {
    src: ctx.image(image),
    alt: image.alt ?? '',
    title: image.title,
    'data-docx-image': '',
    style: { width: pt(image.width), height: pt(image.height), verticalAlign: 'bottom' },
  })

/** Only links Word itself would open become clickable. */
const SAFE_LINK = /^(https?|mailto|tel):/i

const fieldText = (type: 'current' | 'total' | 'section-total', ctx: RenderContext): string => {
  if (!ctx.page) return '0'
  if (type === 'total') return String(ctx.page.total)
  if (type === 'section-total') return String(ctx.page.sectionTotal)
  return ctx.page.number
}

export const renderInline = (items: InlineModel[], ctx: RenderContext): VNodeChild[] =>
  items.map((item): VNodeChild => {
    switch (item.kind) {
      case 'text':
        return h('span', { style: runCss(item.style) }, item.text)
      case 'break':
      case 'columnBreak':
        return h('br')
      case 'tab':
        return h('span', { 'data-docx-tab': '' }, '\t')
      case 'pageBreak':
        return null
      case 'pageNumber':
        return h('span', { style: runCss(item.style), 'data-docx-field': item.type }, fieldText(item.type, ctx))
      case 'footnote':
        return h(
          'sup',
          { style: { fontSize: '65%', lineHeight: 0 }, 'data-docx-footnote-ref': item.id },
          String(item.id),
        )
      case 'image':
        return renderImage(item, ctx)
      case 'bookmark':
        return h(
          'span',
          { id: `${ctx.id}-${item.id}`, 'data-docx-bookmark': item.id },
          renderInline(item.children, ctx),
        )
      case 'link': {
        const href =
          item.anchor !== undefined
            ? `#${ctx.id}-${item.anchor}`
            : SAFE_LINK.test(item.href ?? '')
              ? item.href
              : undefined
        const external = item.anchor === undefined
        return h(
          'a',
          { href, ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}), style: { color: 'inherit' } },
          renderInline(item.children, ctx),
        )
      }
    }
  })

/** Text after each tab moves to its tab stop. */
const renderTabbed = (paragraph: ParagraphModel, ctx: RenderContext): VNodeChild[] => {
  const stops = paragraph.style.tabStops ?? []
  const segments: InlineModel[][] = []
  let segment: InlineModel[] = []
  for (const item of paragraph.children) {
    if (item.kind === 'tab') {
      segments.push(segment)
      segment = []
    } else segment.push(item)
  }
  segments.push(segment)
  return segments.map((segment, index) => {
    const content = renderInline(segment, ctx)
    if (index === 0) return content
    const stop = stops[index - 1]
    if (!stop) return [h('span', { 'data-docx-tab': '' }, '\t'), ...content]
    const position: CSSProperties =
      stop.type === 'right' || stop.type === 'decimal'
        ? { right: pt(ctx.width - stop.position) }
        : stop.type === 'center'
          ? { left: pt(stop.position), transform: 'translateX(-50%)' }
          : { left: pt(stop.position) }
    return h(
      'span',
      { style: { position: 'absolute', whiteSpace: 'pre', ...position }, 'data-docx-tab-stop': '' },
      content,
    )
  })
}

const sideCss = (sides: SidesModel<BorderModel> | undefined): CSSProperties => {
  if (!sides) return {}
  const css: CSSProperties = {}
  if (sides.top) css.borderTop = borderCss(sides.top)
  if (sides.right) css.borderRight = borderCss(sides.right)
  if (sides.bottom) css.borderBottom = borderCss(sides.bottom)
  if (sides.left) css.borderLeft = borderCss(sides.left)
  return css
}

export const renderParagraph = (
  paragraph: ParagraphModel,
  ctx: RenderContext,
  options: { id?: string; before?: VNodeChild } = {},
): VNode => {
  const { style } = paragraph
  const { model } = ctx
  const look = style.heading === undefined ? undefined : model.headings[style.heading]
  const {
    align: lookAlign,
    spaceBefore: lookBefore,
    spaceAfter: lookAfter,
    keepNext: _keepNext,
    ...lookRun
  } = look ?? {}
  const { list } = style
  const level = list ? model.lists.find((item) => item.id === list.id)?.levels[list.level] : undefined
  const left = style.indent?.left ?? level?.indent ?? 0
  const hanging = style.indent?.hanging ?? (style.indent?.firstLine === undefined ? level?.hanging : undefined)
  const marker = ctx.flow.markers.get(paragraph)
  const tabbed = Boolean(style.tabStops?.length) && paragraph.children.some((item) => item.kind === 'tab')
  const css: CSSProperties = {
    margin: 0,
    paddingTop: pt(style.spaceBefore ?? lookBefore ?? 0),
    paddingBottom: pt(style.spaceAfter ?? lookAfter ?? model.defaults.spaceAfter ?? 0),
    paddingLeft: left ? pt(left) : undefined,
    paddingRight: style.indent?.right ? pt(style.indent.right) : undefined,
    textIndent: style.indent?.firstLine ? pt(style.indent.firstLine) : hanging ? pt(-hanging) : undefined,
    textAlign: style.align ?? lookAlign,
    lineHeight: style.lineHeight === undefined ? undefined : style.lineHeight * LINE,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    tabSize: '36pt',
    backgroundColor: style.background,
    position: tabbed ? 'relative' : undefined,
    ...sideCss(style.border),
    ...runCss(lookRun),
    ...runCss(style.mark ?? {}),
  }
  const content =
    paragraph.children.length > 0
      ? tabbed
        ? renderTabbed(paragraph, ctx)
        : renderInline(paragraph.children, ctx)
      : ['​']
  return h(
    'p',
    {
      id: options.id,
      style: css,
      'data-docx-paragraph': '',
      'data-docx-heading': style.heading,
      'data-docx-style': style.styleId,
    },
    [
      options.before,
      marker === undefined
        ? null
        : h(
            'span',
            {
              'data-docx-list-marker': '',
              style: { display: 'inline-block', minWidth: pt(hanging ?? 0), textIndent: 0 },
            },
            marker,
          ),
      ...content,
    ],
  )
}

/** The column each cell starts in, with row spans from above taken into account. */
export const cellColumns = (table: TableModel): { columns: number[][]; count: number } => {
  const taken: boolean[][] = []
  let count = table.columnWidths.length
  const columns = table.rows.map((row, rowIndex) => {
    let column = 0
    return row.cells.map((cell) => {
      while (taken[rowIndex]?.[column]) column++
      const start = column
      for (let down = 0; down < cell.rowSpan; down++) {
        const line = (taken[rowIndex + down] ??= [])
        for (let across = 0; across < cell.colSpan; across++) line[start + across] = true
      }
      column += cell.colSpan
      count = Math.max(count, column)
      return start
    })
  })
  return { columns, count }
}

const VERTICAL = { top: 'top', center: 'middle', bottom: 'bottom' } as const

export const renderTable = (
  table: TableModel,
  ctx: RenderContext,
  range?: { rows: [number, number]; repeat: number },
): VNode => {
  const { columns, count } = cellColumns(table)
  const [start, end] = range?.rows ?? [0, table.rows.length]
  const shown = [...Array.from({ length: range?.repeat ?? 0 }, (_, index) => index)]
  for (let index = start; index < end; index++) shown.push(index)
  const firstRow = shown[0] ?? 0
  const lastRow = end - 1
  const edges = table.borders
  const edge = (side: 'top' | 'right' | 'bottom' | 'left', outer: boolean): BorderModel | undefined => {
    if (edges === 'none') return undefined
    if (outer) return edges[side]
    return side === 'top' || side === 'bottom' ? edges.insideH : edges.insideV
  }
  const width = table.width.unit === '%' ? (ctx.width * table.width.value) / 100 : table.width.value
  const cellWidth = (cell: CellModel, column: number): number =>
    cell.width ??
    (table.columnWidths.length > 0
      ? table.columnWidths.slice(column, column + cell.colSpan).reduce((sum, value) => sum + value, 0)
      : (width / count) * cell.colSpan)
  const renderCell = (cell: CellModel, rowIndex: number, column: number): VNode => {
    const outer = {
      top: rowIndex === firstRow,
      bottom: rowIndex + cell.rowSpan - 1 >= lastRow,
      left: column === 0,
      right: column + cell.colSpan >= count,
    }
    const border = (side: keyof typeof outer): string =>
      cell.borders === 'none' ? 'none' : borderCss(cell.borders?.[side] ?? edge(side, outer[side]))
    const padding = (side: keyof typeof outer): string =>
      pt(cell.padding?.[side] ?? table.cellPadding?.[side] ?? CELL_PADDING[side])
    const inner = cellWidth(cell, column) - (cell.padding?.left ?? table.cellPadding?.left ?? CELL_PADDING.left) * 2
    return h(
      'td',
      {
        colspan: cell.colSpan > 1 ? cell.colSpan : undefined,
        rowspan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
        'data-docx-cell': '',
        style: {
          padding: `${padding('top')} ${padding('right')} ${padding('bottom')} ${padding('left')}`,
          borderTop: border('top'),
          borderRight: border('right'),
          borderBottom: border('bottom'),
          borderLeft: border('left'),
          backgroundColor: cell.background,
          verticalAlign: VERTICAL[cell.verticalAlign],
          width: cell.width === undefined ? undefined : pt(cell.width),
        },
      },
      renderBlocks(cell.children, { ...ctx, width: Math.max(inner, 0) }),
    )
  }
  return h(
    'table',
    {
      'data-docx-table': '',
      style: {
        borderCollapse: 'collapse',
        width: table.width.unit === '%' ? `${table.width.value}%` : pt(table.width.value),
        tableLayout: table.layout,
        marginLeft: table.align === 'center' || table.align === 'right' ? 'auto' : undefined,
        marginRight: table.align === 'center' ? 'auto' : undefined,
      },
    },
    [
      table.columnWidths.length > 0
        ? h(
            'colgroup',
            table.columnWidths.map((value) => h('col', { style: { width: pt(value) } })),
          )
        : null,
      h(
        'tbody',
        shown.map((rowIndex) => {
          const row = at(table.rows, rowIndex)
          return h(
            'tr',
            {
              'data-docx-row': '',
              'data-docx-header-row': row.header ? '' : undefined,
              style: { height: row.height === undefined ? undefined : pt(row.height) },
            },
            row.cells.map((cell, cellIndex) => renderCell(cell, rowIndex, at(at(columns, rowIndex), cellIndex))),
          )
        }),
      ),
    ],
  )
}

const renderToc = (toc: TocModel, ctx: RenderContext): VNode => {
  const [from, to] = toc.levels
  const entries = ctx.flow.headings.filter((heading) => heading.level >= from && heading.level <= to)
  const spaceAfter = pt(ctx.model.defaults.spaceAfter ?? 0)
  return h('div', { 'data-docx-toc': '' }, [
    toc.title === undefined
      ? null
      : h(
          'p',
          {
            style: {
              margin: 0,
              paddingBottom: pt(TOC_TITLE.spaceAfter),
              fontSize: pt(TOC_TITLE.size),
              fontWeight: 700,
            },
          },
          toc.title,
        ),
    ...entries.map((entry) => {
      const text = toc.hyperlinks
        ? h('a', { href: `#${ctx.id}-${entry.key}`, style: { color: 'inherit', textDecoration: 'none' } }, entry.text)
        : h('span', entry.text)
      return h(
        'p',
        {
          'data-docx-toc-entry': entry.level,
          style: { margin: 0, paddingBottom: spaceAfter, paddingLeft: pt((entry.level - from) * 11), display: 'flex' },
        },
        [
          text,
          h('span', { 'aria-hidden': 'true', style: { flex: 1, borderBottom: '1pt dotted', margin: '0 3pt 0.3em' } }),
          h('span', ctx.headingPages?.get(entry.key) ?? ''),
        ],
      )
    }),
    entries.length === 0
      ? h(
          'p',
          { style: { margin: 0, paddingBottom: spaceAfter, fontStyle: 'italic' } },
          'No table of contents entries found.',
        )
      : null,
  ])
}

export const renderBlock = (block: BlockModel, ctx: RenderContext, id?: string): VNode => {
  switch (block.kind) {
    case 'paragraph':
      return renderParagraph(block, ctx, { id })
    case 'table':
      return renderTable(block, ctx)
    case 'toc':
      return renderToc(block, ctx)
  }
}

export const renderBlocks = (blocks: BlockModel[], ctx: RenderContext): VNode[] =>
  blocks.map((block) => renderBlock(block, ctx))

export const renderFootnote = (id: number, ctx: RenderContext): VNode => {
  const note = ctx.model.footnotes.find((item) => item.id === id)
  const mark = h('sup', { style: { fontSize: '65%', lineHeight: 0 } }, String(id))
  return h(
    'div',
    { 'data-docx-footnote': id, style: { fontSize: pt(FOOTNOTE_SIZE), lineHeight: LINE } },
    (note?.children ?? []).map((paragraph, index) =>
      renderParagraph(paragraph, ctx, { before: index === 0 ? [mark, ' '] : undefined }),
    ),
  )
}

export const renderFootnotes = (ids: number[], ctx: RenderContext): VNode | null =>
  ids.length === 0
    ? null
    : h('div', { 'data-docx-footnotes': '', style: { marginTop: 'auto' } }, [
        h(
          'div',
          { 'aria-hidden': 'true', style: { height: pt(FOOTNOTE_SEPARATOR), display: 'flex', alignItems: 'center' } },
          h('div', { style: { width: '144pt', borderTop: '0.5pt solid currentColor' } }),
        ),
        ...ids.map((id) => renderFootnote(id, ctx)),
      ])
