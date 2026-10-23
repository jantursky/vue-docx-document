import type {
  Align,
  DocumentProps,
  HeaderFooterProps,
  HeadingLevel,
  ImageProps,
  ListProps,
  PageNumberProps,
  SectionProps,
  TableCellProps,
  TableOfContentsProps,
  TableProps,
  TableRowProps,
  TextRunProps,
} from '../components/types'
import { optionalColor } from './colors'
import {
  BULLETS,
  COLUMN_SPACE,
  DEFAULT_BORDER,
  DOCUMENT_DEFAULTS,
  HEADER_MARGIN,
  HEADING_LEVELS,
  HEADING_LOOKS,
  LINK_STYLE,
  LIST_HANGING,
  LIST_INDENT,
  MAX_LIST_LEVELS,
  ORDERED_FORMATS,
  PAGE_MARGIN,
  PAGE_SIZES,
} from './defaults'
import { fitImage, intrinsicSize, loadImage, sniffType, type ImageCache } from './images'
import type {
  BlockModel,
  CellModel,
  DocxModel,
  HeaderFooterSet,
  ImageModel,
  InlineModel,
  ListModel,
  ParagraphModel,
  ParagraphStyleModel,
  RowModel,
  RunStyleModel,
  SectionModel,
  TableModel,
} from './model'
import { TYPES } from './nodes'
import type { TreeNode } from './snapshot'
import { border, borderSides, cascade, defined, lengthSides, paragraphStyle, runStyle } from './styles'
import { optionalPoints, toPoints } from './units'
import { warnOnce } from './warn'

type Child = TreeNode | string

const NAMES: Record<string, string> = {
  [TYPES.document]: 'Document',
  [TYPES.section]: 'Section',
  [TYPES.header]: 'Header',
  [TYPES.footer]: 'Footer',
  [TYPES.paragraph]: 'Paragraph',
  [TYPES.run]: 'TextRun',
  [TYPES.link]: 'Link',
  [TYPES.bookmark]: 'Bookmark',
  [TYPES.break]: 'Break',
  [TYPES.tab]: 'Tab',
  [TYPES.pageBreak]: 'PageBreak',
  [TYPES.columnBreak]: 'ColumnBreak',
  [TYPES.pageNumber]: 'PageNumber',
  [TYPES.footnote]: 'Footnote',
  [TYPES.image]: 'Image',
  [TYPES.table]: 'Table',
  [TYPES.row]: 'TableRow',
  [TYPES.cell]: 'TableCell',
  [TYPES.list]: 'List',
  [TYPES.listItem]: 'ListItem',
  [TYPES.toc]: 'TableOfContents',
}

const tag = (type: string): string => `<${NAMES[type] ?? type}>`

// Typed this way so a call narrows like a `throw`.
const fail: (message: string) => never = (message) => {
  throw new Error(`[vue-docx-document] ${message}`)
}

/** The one parent some elements need. */
const REQUIRED_PARENT: Record<string, string> = {
  [TYPES.section]: TYPES.document,
  [TYPES.header]: TYPES.section,
  [TYPES.footer]: TYPES.section,
  [TYPES.toc]: TYPES.section,
  [TYPES.row]: TYPES.table,
  [TYPES.cell]: TYPES.row,
  [TYPES.listItem]: TYPES.list,
}

const misplaced = (type: string, parent: string): never => {
  const required = REQUIRED_PARENT[type]
  if (required) return fail(`${tag(type)} must be a direct child of ${tag(required)}, not of ${tag(parent)}.`)
  return fail(`${tag(type)} can't be inside ${tag(parent)}.`)
}

/** Inline elements: loose ones in a block container share an implicit paragraph. */
const INLINE = new Set<string>([
  TYPES.run,
  TYPES.link,
  TYPES.bookmark,
  TYPES.break,
  TYPES.tab,
  TYPES.columnBreak,
  TYPES.pageNumber,
  TYPES.footnote,
])

const SAFE_LINK = /^(https?|mailto|tel):/i

const BOOKMARK_ID = /^[A-Za-z]\w{0,39}$/

interface State {
  lists: ListModel[]
  footnotes: DocxModel['footnotes']
  /** Image loads, awaited once the tree is walked. */
  tasks: Promise<void>[]
  images: ImageCache
  bookmarks: Set<string>
  anchors: Set<string>
  toc: boolean
}

interface Context {
  state: State
  run: RunStyleModel
  /** Headers and footers can't hold footnotes; footnotes hold paragraphs only. */
  where: 'body' | 'header' | 'footnote'
  parent: string
  /** Paragraphs get no space after unless they set it, as Word's table, header and footnote styles do. */
  compact: boolean
  /** Alignment of implicit paragraphs, from `<TableCell align>`. */
  align?: Align
  inLink: boolean
}

interface ListOwner {
  model: ListModel
  /** Levels a nested `<List>` already set; the first one at each level wins. */
  configured: Set<number>
}

const withCompact = (style: ParagraphStyleModel, ctx: Context): ParagraphStyleModel =>
  ctx.compact && style.spaceAfter === undefined ? { ...style, spaceAfter: 0 } : style

const BREAKS = new Set<string>(['break', 'pageBreak', 'columnBreak'])

/** Text, breaks and the rest in reading order, with links and bookmarks opened. */
const leaves = (items: InlineModel[]): InlineModel[] =>
  items.flatMap((item) => (item.kind === 'link' || item.kind === 'bookmark' ? leaves(item.children) : [item]))

/**
 * Trims whitespace at the edges of a paragraph and around line breaks, as HTML does, also when
 * the edge is inside a link or bookmark. Empty text, such as Vue's fragment anchors, is dropped.
 */
const trimEdges = (items: InlineModel[]): InlineModel[] => {
  const trimmed = new Map<InlineModel, string>()
  const trim = (sequence: InlineModel[], cut: (text: string) => string): void => {
    let edge = true
    for (const item of sequence) {
      if (item.kind !== 'text') edge = BREAKS.has(item.kind)
      else if (edge) {
        const text = cut(trimmed.get(item) ?? item.text)
        trimmed.set(item, text)
        edge = text === ''
      }
    }
  }
  const flat = leaves(items)
  trim(flat, (text) => text.trimStart())
  trim(flat.reverse(), (text) => text.trimEnd())
  const rebuild = (list: InlineModel[]): InlineModel[] =>
    list.flatMap((item): InlineModel[] => {
      if (item.kind === 'link' || item.kind === 'bookmark') return [{ ...item, children: rebuild(item.children) }]
      if (item.kind !== 'text') return [item]
      const text = trimmed.get(item) ?? item.text
      if (text === '') return []
      return [text === item.text ? item : { ...item, text }]
    })
  return rebuild(items)
}

/** Text with its line feeds as line breaks, so Word and the preview both start a new line. */
const textItems = (text: string, style: RunStyleModel): InlineModel[] =>
  text.split(/\r?\n/).flatMap((line, index): InlineModel[] => {
    const item: InlineModel = { kind: 'text', text: line, style: { ...style } }
    return index === 0 ? [item] : [{ kind: 'break' }, item]
  })

const loadInto = async (model: ImageModel, props: ImageProps, cache: ImageCache): Promise<void> => {
  const data = await loadImage(props.src, cache)
  const type = props.type ?? sniffType(data) ?? fail('An <Image> src is not a PNG, JPEG, GIF, BMP or SVG image.')
  const size = fitImage(intrinsicSize(data, type), optionalPoints(props.width), optionalPoints(props.height))
  Object.assign(model, { data, type, width: size.width, height: size.height })
  if (type !== 'svg') return
  if (props.fallback == null) {
    fail("An SVG <Image> needs a fallback: a PNG, JPEG, GIF or BMP image that Word shows where it can't draw SVG.")
  }
  const fallback = await loadImage(props.fallback, cache)
  const fallbackType = sniffType(fallback)
  if (!fallbackType || fallbackType === 'svg')
    fail('The fallback of an SVG <Image> must be a PNG, JPEG, GIF or BMP image.')
  model.fallback = { data: fallback, type: fallbackType }
}

const image = (node: TreeNode, ctx: Context): ImageModel => {
  const props = node.props as unknown as ImageProps
  // Filled in by the load; the walk stays synchronous so document order is kept.
  const model: ImageModel = { kind: 'image', data: new Uint8Array(), type: 'png', width: 0, height: 0 }
  if (props.alt !== undefined) model.alt = props.alt
  if (props.title !== undefined) model.title = props.title
  ctx.state.tasks.push(loadInto(model, props, ctx.state.images))
  return model
}

const footnote = (node: TreeNode, ctx: Context): InlineModel => {
  if (ctx.where === 'header') fail('<Footnote> works in the body only, not in a <Header> or <Footer>.')
  if (ctx.where === 'footnote') fail("<Footnote> can't be inside another <Footnote>.")
  const { footnotes } = ctx.state
  const entry = { id: footnotes.length + 1, children: [] as ParagraphModel[] }
  footnotes.push(entry)
  entry.children = blocks(node.children, {
    state: ctx.state,
    run: {},
    where: 'footnote',
    parent: TYPES.footnote,
    compact: true,
    inLink: false,
  }) as ParagraphModel[]
  return { kind: 'footnote', id: entry.id }
}

const link = (node: TreeNode, ctx: Context): InlineModel[] => {
  if (ctx.inLink) fail("<Link> can't be inside another <Link>.")
  const href = node.props.href as string | undefined
  const anchor = node.props.anchor as string | undefined
  const children = (run: RunStyleModel) => inlines(node.children, { ...ctx, run, inLink: true, parent: node.type })
  const linked = () => children(cascade({ ...ctx.run, ...LINK_STYLE }, node.props))
  if (href === undefined) {
    if (anchor === undefined) return fail('<Link> needs an href or an anchor.')
    ctx.state.anchors.add(anchor)
    return [{ kind: 'link', anchor, children: linked() }]
  }
  if (!SAFE_LINK.test(href.trim())) {
    warnOnce(`The link "${href}" is not http, https, mailto or tel, so it is written as plain text.`)
    return children(ctx.run)
  }
  return [{ kind: 'link', href: href.trim(), children: linked() }]
}

const inline = (child: Child, ctx: Context): InlineModel[] => {
  if (typeof child === 'string') return textItems(child, ctx.run)
  const { props } = child
  const inner = (run: RunStyleModel) =>
    child.children.flatMap((item) => inline(item, { ...ctx, run, parent: child.type }))
  switch (child.type) {
    case TYPES.run: {
      const run = cascade(ctx.run, props)
      const { text } = props as TextRunProps
      if (child.children.length === 0 && text !== undefined) return textItems(text, run)
      return inner(run)
    }
    case TYPES.link:
      return link(child, ctx)
    case TYPES.bookmark: {
      const id = props.id
      if (typeof id !== 'string' || !BOOKMARK_ID.test(id)) {
        return fail(
          `<Bookmark id="${String(id)}"> is not a bookmark name Word takes: a letter, then letters, digits or underscores, 40 characters at most.`,
        )
      }
      if (ctx.state.bookmarks.has(id)) fail(`Two <Bookmark>s have the id "${id}".`)
      ctx.state.bookmarks.add(id)
      return [{ kind: 'bookmark', id, children: inner(ctx.run) }]
    }
    case TYPES.break:
      return [{ kind: 'break' }]
    case TYPES.tab:
      return [{ kind: 'tab' }]
    case TYPES.pageBreak:
      return [{ kind: 'pageBreak' }]
    case TYPES.columnBreak:
      return [{ kind: 'columnBreak' }]
    case TYPES.pageNumber:
      return [
        {
          kind: 'pageNumber',
          type: (props as PageNumberProps).type ?? 'current',
          style: cascade(ctx.run, props),
        },
      ]
    case TYPES.footnote:
      return [footnote(child, ctx)]
    case TYPES.image:
      return [image(child, ctx)]
    default:
      return misplaced(child.type, ctx.parent)
  }
}

const inlines = (children: Child[], ctx: Context): InlineModel[] => children.flatMap((child) => inline(child, ctx))

/** The content of one paragraph. */
const paragraphInlines = (children: Child[], ctx: Context): InlineModel[] => trimEdges(inlines(children, ctx))

const paragraph = (node: TreeNode, ctx: Context): ParagraphModel => {
  const run = cascade(ctx.run, node.props)
  const style = withCompact(paragraphStyle(node.props), ctx)
  const children = paragraphInlines(node.children, { ...ctx, run, parent: node.type })
  // An empty paragraph is a blank line; its run formatting is all that sets its height.
  if (children.length === 0 && Object.keys(run).length > 0) style.mark = run
  return { kind: 'paragraph', style, children }
}

const listLevel = (level: number, props: ListProps, ordered: boolean): ListModel['levels'][number] => ({
  format: ordered ? (props.format ?? ORDERED_FORMATS[level % ORDERED_FORMATS.length] ?? 'decimal') : 'bullet',
  text: ordered ? `%${level + 1}.` : (props.bullet ?? BULLETS[level % BULLETS.length] ?? '•'),
  start: props.start ?? 1,
  indent: LIST_INDENT * (level + 1),
  hanging: LIST_HANGING,
})

const listItem = (node: TreeNode, ctx: Context, level: number, owner: ListOwner): ParagraphModel[] => {
  const run = cascade(ctx.run, node.props)
  const style = withCompact(paragraphStyle(node.props), ctx)
  delete style.heading
  const out: ParagraphModel[] = []
  let pending: Child[] = []
  const flush = (): void => {
    const children = paragraphInlines(pending, { ...ctx, run, parent: node.type })
    pending = []
    if (out.length === 0) {
      out.push({ kind: 'paragraph', style: { ...style, list: { id: owner.model.id, level } }, children })
    } else if (children.length > 0) {
      // Text after a nested list continues the item: indented like it, without a marker.
      const indent = { left: owner.model.levels[level]?.indent ?? 0, ...style.indent }
      out.push({ kind: 'paragraph', style: { ...style, indent }, children })
    }
  }
  for (const child of node.children) {
    if (typeof child !== 'string' && child.type === TYPES.list) {
      flush()
      out.push(...list(child, { ...ctx, run, parent: node.type }, level + 1, owner))
    } else pending.push(child)
  }
  flush()
  return out
}

const list = (node: TreeNode, ctx: Context, level = 0, parentOwner?: ListOwner): ParagraphModel[] => {
  if (ctx.where === 'footnote') fail("<List> can't be inside <Footnote>; footnotes hold paragraphs.")
  if (level >= MAX_LIST_LEVELS) fail(`Lists nest ${MAX_LIST_LEVELS} levels deep at most.`)
  const props = node.props as ListProps
  const ordered = Boolean(props.ordered)
  let owner = parentOwner
  if (!owner) {
    const levels = Array.from({ length: MAX_LIST_LEVELS }, (_, index) => listLevel(index, {}, ordered))
    const model: ListModel = { id: `list${ctx.state.lists.length + 1}`, ordered, start: props.start ?? 1, levels }
    ctx.state.lists.push(model)
    owner = { model, configured: new Set() }
  }
  if (!owner.configured.has(level)) {
    owner.configured.add(level)
    owner.model.levels[level] = listLevel(level, props, ordered)
  }
  const run = cascade(ctx.run, props)
  return node.children.flatMap((child) => {
    if (typeof child === 'string') return fail(`Text inside <List> must be in a <ListItem>.`)
    if (child.type !== TYPES.listItem) return misplaced(child.type, TYPES.list)
    return listItem(child, { ...ctx, run, parent: TYPES.list }, level, owner)
  })
}

const allBorders = (): Exclude<TableModel['borders'], 'none'> => ({
  top: DEFAULT_BORDER,
  right: DEFAULT_BORDER,
  bottom: DEFAULT_BORDER,
  left: DEFAULT_BORDER,
  insideH: DEFAULT_BORDER,
  insideV: DEFAULT_BORDER,
})

const tableBorders = (value: TableProps['borders']): TableModel['borders'] => {
  if (value === 'none') return 'none'
  if (!value) return allBorders()
  return defined({
    ...borderSides(value),
    insideH: value.insideH && border(value.insideH),
    insideV: value.insideV && border(value.insideV),
  })
}

const tableWidth = (value: TableProps['width']): TableModel['width'] => {
  if (value === undefined) return { value: 100, unit: '%' }
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    const percent = Number(value.trim().slice(0, -1))
    if (!Number.isFinite(percent) || percent <= 0) {
      fail(`<Table width="${value}"> is not a percentage. Use one such as "50%".`)
    }
    return { value: percent, unit: '%' }
  }
  return { value: toPoints(value as Exclude<typeof value, `${number}%`>), unit: 'pt' }
}

const structuralChildren = (node: TreeNode, expected: string): TreeNode[] =>
  node.children.map((child) => {
    if (typeof child === 'string') return fail(`Text inside ${tag(node.type)} must be in a ${tag(expected)}.`)
    if (child.type !== expected) return misplaced(child.type, node.type)
    return child
  })

const cell = (node: TreeNode, ctx: Context, run: RunStyleModel, rowBackground?: string): CellModel => {
  const props = node.props as TableCellProps
  const cellRun = cascade(run, props)
  return defined({
    colSpan: props.colSpan ?? 1,
    rowSpan: props.rowSpan ?? 1,
    background: optionalColor(props.background) ?? rowBackground,
    verticalAlign: props.verticalAlign ?? 'top',
    width: optionalPoints(props.width),
    borders: props.borders === 'none' ? 'none' : borderSides(props.borders),
    padding: lengthSides(props.padding),
    children: blocks(node.children, {
      ...ctx,
      run: cellRun,
      parent: node.type,
      compact: true,
      align: props.align,
    }),
  })
}

const row = (node: TreeNode, ctx: Context, run: RunStyleModel): RowModel => {
  const props = node.props as TableRowProps
  const rowRun = cascade(run, props)
  const background = optionalColor(props.background)
  return defined({
    header: Boolean(props.header),
    cantSplit: Boolean(props.cantSplit),
    height: optionalPoints(props.height),
    cells: structuralChildren(node, TYPES.cell).map((child) => cell(child, ctx, rowRun, background)),
  })
}

const table = (node: TreeNode, ctx: Context): TableModel => {
  if (ctx.where === 'footnote') fail("<Table> can't be inside <Footnote>; footnotes hold paragraphs.")
  const props = node.props as TableProps
  const run = cascade(ctx.run, props)
  const columnWidths = (props.columnWidths ?? []).map(toPoints)
  return defined({
    kind: 'table',
    width: tableWidth(props.width),
    columnWidths,
    layout: props.layout ?? (columnWidths.length > 0 ? 'fixed' : 'auto'),
    align: props.align,
    borders: tableBorders(props.borders),
    cellPadding: lengthSides(props.cellPadding),
    rows: structuralChildren(node, TYPES.row).map((child) => row(child, ctx, run)),
  })
}

const block = (node: TreeNode, ctx: Context): BlockModel[] => {
  switch (node.type) {
    case TYPES.paragraph:
      return [paragraph(node, ctx)]
    case TYPES.table:
      return [table(node, ctx)]
    case TYPES.list:
      return list(node, ctx)
    case TYPES.image: {
      const align = (node.props as unknown as ImageProps).align
      const style = withCompact(defined({ align }), ctx)
      return [{ kind: 'paragraph', style, children: [image(node, ctx)] }]
    }
    case TYPES.pageBreak:
      return [{ kind: 'paragraph', style: {}, children: [{ kind: 'pageBreak' }] }]
    case TYPES.toc: {
      if (ctx.parent !== TYPES.section) misplaced(node.type, ctx.parent)
      const props = node.props as TableOfContentsProps
      ctx.state.toc = true
      return [
        defined({
          kind: 'toc' as const,
          title: props.title,
          levels: props.levels ?? [1, 3],
          hyperlinks: props.hyperlinks !== false,
        }),
      ]
    }
    default:
      return misplaced(node.type, ctx.parent)
  }
}

/** A block container's children: blocks as they are, loose inline content in implicit paragraphs. */
const blocks = (children: Child[], ctx: Context): BlockModel[] => {
  const out: BlockModel[] = []
  let loose: Child[] = []
  const flush = (): void => {
    const content = paragraphInlines(loose, ctx)
    loose = []
    if (content.length > 0) {
      out.push({ kind: 'paragraph', style: withCompact(defined({ align: ctx.align }), ctx), children: content })
    }
  }
  for (const child of children) {
    if (typeof child === 'string' || INLINE.has(child.type)) loose.push(child)
    else {
      flush()
      out.push(...block(child, ctx))
    }
  }
  flush()
  return out
}

const PAGE_SIZE_NAMES = Object.keys(PAGE_SIZES).join(', ')

const pageOf = (props: SectionProps): SectionModel['page'] => {
  const size = props.size ?? 'A4'
  let { width, height } =
    typeof size === 'string'
      ? ((PAGE_SIZES as Record<string, { width: number; height: number }>)[size] ??
        fail(`Unknown page size "${size}". Use ${PAGE_SIZE_NAMES} or { width, height }.`))
      : { width: toPoints(size.width), height: toPoints(size.height) }
  const orientation = props.orientation ?? (width > height ? 'landscape' : 'portrait')
  if ((orientation === 'landscape') !== width > height) [width, height] = [height, width]
  return { width, height, orientation }
}

const marginOf = (value: SectionProps['margin']): SectionModel['margin'] => {
  const sides = typeof value === 'object' ? value : { top: value, right: value, bottom: value, left: value }
  return {
    top: optionalPoints(sides.top) ?? PAGE_MARGIN,
    right: optionalPoints(sides.right) ?? PAGE_MARGIN,
    bottom: optionalPoints(sides.bottom) ?? PAGE_MARGIN,
    left: optionalPoints(sides.left) ?? PAGE_MARGIN,
    header: optionalPoints('header' in sides ? sides.header : undefined) ?? HEADER_MARGIN,
    footer: optionalPoints('footer' in sides ? sides.footer : undefined) ?? HEADER_MARGIN,
    gutter: optionalPoints('gutter' in sides ? sides.gutter : undefined) ?? 0,
  }
}

const columnsOf = (value: SectionProps['columns']): SectionModel['columns'] => {
  if (value === undefined) return undefined
  if (typeof value === 'number') return { count: value, space: COLUMN_SPACE, separator: false }
  return { count: value.count, space: optionalPoints(value.space) ?? COLUMN_SPACE, separator: Boolean(value.separator) }
}

const HEADER_TYPES = new Set(['default', 'first', 'even'])

const section = (node: TreeNode, state: State): SectionModel => {
  const props = node.props as SectionProps
  const headers: HeaderFooterSet = {}
  const footers: HeaderFooterSet = {}
  const content: Child[] = []
  for (const child of node.children) {
    if (typeof child === 'string' || (child.type !== TYPES.header && child.type !== TYPES.footer)) {
      content.push(child)
      continue
    }
    const type = (child.props as HeaderFooterProps).type ?? 'default'
    if (!HEADER_TYPES.has(type)) fail(`${tag(child.type)} type="${type}" is not default, first or even.`)
    const set = child.type === TYPES.header ? headers : footers
    if (set[type]) fail(`A <Section> has two ${tag(child.type).slice(0, -1)} type="${type}">.`)
    set[type] = blocks(child.children, {
      state,
      run: {},
      where: 'header',
      parent: child.type,
      compact: true,
      inLink: false,
    })
  }
  return defined({
    page: pageOf(props),
    margin: marginOf(props.margin),
    columns: columnsOf(props.columns),
    type: props.type ?? 'nextPage',
    titlePage: Boolean(headers.first ?? footers.first),
    pageNumberStart: props.pageNumberStart,
    pageNumberFormat: props.pageNumberFormat,
    headers,
    footers,
    children: blocks(content, { state, run: {}, where: 'body', parent: TYPES.section, compact: false, inLink: false }),
  })
}

const headingsOf = (overrides: DocumentProps['headings'] = {}): DocxModel['headings'] =>
  Object.fromEntries(
    HEADING_LEVELS.map((level: HeadingLevel) => {
      const own = overrides[level] ?? {}
      const look = {
        ...HEADING_LOOKS[level],
        ...runStyle(own),
        ...defined({
          align: own.align,
          spaceBefore: optionalPoints(own.spaceBefore),
          spaceAfter: optionalPoints(own.spaceAfter),
          keepNext: own.keepNext,
        }),
      }
      return [level, look]
    }),
  )

/** Turns the snapshot into the document model. Loads images; never loads `docx`. */
export const resolve = async (tree: TreeNode): Promise<DocxModel> => {
  const props = tree.props as DocumentProps
  const state: State = {
    lists: [],
    footnotes: [],
    tasks: [],
    images: new Map(),
    bookmarks: new Set(),
    anchors: new Set(),
    toc: false,
  }
  const sections: SectionModel[] = []
  for (const child of tree.children) {
    if (typeof child === 'string') {
      warnOnce(`Text "${child.trim().slice(0, 40)}" inside <Document> is dropped. Put it in a <Section>.`)
    } else if (child.type === TYPES.section) sections.push(section(child, state))
    else misplaced(child.type, TYPES.document)
  }
  if (sections.length === 0) fail('<Document> needs at least one <Section>.')
  await Promise.all(state.tasks)
  for (const anchor of state.anchors) {
    if (!state.bookmarks.has(anchor)) warnOnce(`<Link anchor="${anchor}"> points at no <Bookmark id="${anchor}">.`)
  }
  const model: DocxModel = {
    meta: defined({
      title: props.title,
      subject: props.subject,
      creator: props.creator,
      description: props.description,
      keywords: props.keywords,
      lastModifiedBy: props.lastModifiedBy,
      revision: props.revision,
    }),
    defaults: defined({
      font: props.font ?? DOCUMENT_DEFAULTS.font,
      size: props.fontSize ?? DOCUMENT_DEFAULTS.size,
      color: optionalColor(props.color),
      lineHeight: props.lineHeight ?? DOCUMENT_DEFAULTS.lineHeight,
      spaceAfter: optionalPoints(props.spaceAfter) ?? DOCUMENT_DEFAULTS.spaceAfter,
      language: props.language,
    }),
    headings: headingsOf(props.headings),
    sections,
    footnotes: state.footnotes,
    lists: state.lists,
    evenAndOddHeaders: sections.some((item) => Boolean(item.headers.even ?? item.footers.even)),
    updateFields: state.toc,
  }
  if (props.styles) model.styles = props.styles
  return model
}
