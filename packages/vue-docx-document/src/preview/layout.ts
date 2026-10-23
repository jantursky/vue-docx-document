import { h, type VNode } from 'vue'

import type { BlockModel, DocxModel, HeaderFooterSet, SectionModel } from '../core/model'
import { PT_PER_IN, PX_PER_IN } from '../core/units'
import type { Flow } from './flow'
import { formatNumber } from './format'
import { paginate, rowBreaks, type Page, type PaginateSection } from './paginate'
import {
  fontFamily,
  LINE,
  pt,
  renderBlock,
  renderBlocks,
  renderFootnote,
  renderFootnotes,
  renderTable,
  type RenderContext,
} from './render'
import { at } from './at'

/** Heights in points: each flow item by key (with its table rows), each footnote by id. */
export interface Measurements {
  items: Map<string, { height: number; rows?: number[] }>
  notes: Map<number, number>
}

export const textWidth = (section: SectionModel): number =>
  section.page.width - section.margin.left - section.margin.right - section.margin.gutter

export const columnWidth = (section: SectionModel): number => {
  const count = section.columns?.count ?? 1
  return (textWidth(section) - (section.columns?.space ?? 0) * (count - 1)) / count
}

const bodyHeight = (section: SectionModel): number => section.page.height - section.margin.top - section.margin.bottom

const sameGeometry = (a: SectionModel | undefined, b: SectionModel): boolean =>
  !!a && JSON.stringify([a.page, a.margin]) === JSON.stringify([b.page, b.margin])

const toPoints = (px: number): number => (px * PT_PER_IN) / PX_PER_IN

/** Reads the heights of the measuring layer that `renderMeasure` draws. */
export const measure = (root: HTMLElement): Measurements => {
  const items = new Map<string, { height: number; rows?: number[] }>()
  for (const element of root.querySelectorAll<HTMLElement>('[data-docx-measure-item]')) {
    const table = element.firstElementChild
    const body = table?.tagName === 'TABLE' ? [...table.children].find((child) => child.tagName === 'TBODY') : undefined
    items.set(element.dataset.docxMeasureItem ?? '', {
      height: toPoints(element.getBoundingClientRect().height),
      ...(body ? { rows: [...body.children].map((row) => toPoints(row.getBoundingClientRect().height)) } : {}),
    })
  }
  const notes = new Map<number, number>()
  for (const element of root.querySelectorAll<HTMLElement>('[data-docx-measure-note]')) {
    notes.set(Number(element.dataset.docxMeasureNote), toPoints(element.getBoundingClientRect().height))
  }
  return { items, notes }
}

/** Lays the flow out on pages from measured heights. */
export const layoutPages = (flow: Flow, measured: Measurements): Page[] => {
  const sections = flow.sections.map(({ section, items }, index): PaginateSection => {
    const previous = flow.sections[index - 1]?.section
    return {
      type: section.type,
      ...(section.pageNumberStart === undefined ? {} : { pageNumberStart: section.pageNumberStart }),
      height: bodyHeight(section),
      columns: section.columns?.count ?? 1,
      sameGeometry: sameGeometry(previous, section),
      items: items.map((item) => {
        const size = measured.items.get(item.key)
        const footnoteHeight = item.footnotes.reduce((sum, id) => sum + (measured.notes.get(id) ?? 0), 0)
        const base = {
          height: size?.height ?? 0,
          breakBefore: item.breakBefore,
          keepNext: item.keepNext,
          footnoteHeight,
        }
        if (item.block.kind !== 'table') return base
        const breaks = rowBreaks(item.block)
        const rows = item.block.rows.map((row, rowIndex) => ({
          height: size?.rows?.[rowIndex] ?? 0,
          header: row.header,
          splitBefore: at(breaks, rowIndex),
        }))
        return { ...base, rows }
      }),
    }
  })
  return paginate(sections)
}

/** The page number each heading landed on, as its section formats page numbers. */
export const headingPages = (flow: Flow, pages: Page[], model: DocxModel): Map<string, string> => {
  const keys = new Set(flow.headings.map((heading) => heading.key))
  const out = new Map<string, string>()
  for (const page of pages) {
    for (const part of page.parts) {
      const key = at(at(flow.sections, part.section).items, part.item).key
      if (keys.has(key) && !out.has(key)) {
        out.set(key, formatNumber(page.number, at(model.sections, page.section).pageNumberFormat))
      }
    }
  }
  return out
}

/** Each section's headers or footers, with the ones it doesn't set taken from the section before, as Word does. */
const inherited = (model: DocxModel, kind: 'headers' | 'footers'): HeaderFooterSet[] => {
  const out: HeaderFooterSet[] = []
  model.sections.forEach((section, index) => {
    const previous = out[index - 1] ?? {}
    const own = section[kind]
    out.push({
      default: own.default ?? previous.default,
      first: own.first ?? previous.first,
      even: own.even ?? previous.even,
    })
  })
  return out
}

const pick = (set: HeaderFooterSet, page: Page, model: DocxModel): BlockModel[] | undefined => {
  const section = at(model.sections, page.section)
  if (section.titlePage && page.first) return set.first
  if (model.evenAndOddHeaders && page.number % 2 === 0) return set.even
  return set.default
}

const sheetStyle = (model: DocxModel) => ({
  fontFamily: model.defaults.font ? fontFamily(model.defaults.font) : undefined,
  fontSize: model.defaults.size === undefined ? undefined : pt(model.defaults.size),
  color: model.defaults.color ?? '#000000',
  lineHeight: (model.defaults.lineHeight ?? 1) * LINE,
})

/** Every flow item and footnote at its column width, hidden, so `measure` can read the heights. */
export const renderMeasure = (ctx: RenderContext): VNode =>
  h('div', { style: sheetStyle(ctx.model) }, [
    ...ctx.flow.sections.map(({ section, items }, index) =>
      h(
        'div',
        { 'data-docx-measure-section': index, style: { width: pt(columnWidth(section)) } },
        items.map((item) =>
          h(
            'div',
            { 'data-docx-measure-item': item.key, style: { display: 'flow-root' } },
            renderBlock(item.block, { ...ctx, width: columnWidth(section) }),
          ),
        ),
      ),
    ),
    h(
      'div',
      { style: { width: pt(textWidth(at(ctx.model.sections, 0))) } },
      ctx.model.footnotes.map((note) =>
        h('div', { 'data-docx-measure-note': note.id, style: { display: 'flow-root' } }, renderFootnote(note.id, ctx)),
      ),
    ),
  ])

export const renderPages = (pages: Page[], ctx: RenderContext, scale: number): VNode[] => {
  const { model, flow } = ctx
  const headers = inherited(model, 'headers')
  const footers = inherited(model, 'footers')
  return pages.map((page, index) => {
    const section = at(model.sections, page.section)
    const { width, height } = section.page
    const margin = section.margin
    const pageCtx: RenderContext = {
      ...ctx,
      width: textWidth(section),
      page: {
        number: formatNumber(page.number, section.pageNumberFormat),
        total: pages.length,
        sectionTotal: pages.filter((other) => other.section === page.section).length,
      },
    }
    // Consecutive parts of one section share a region, which carries that section's columns.
    const regions: { section: number; nodes: VNode[] }[] = []
    const notes: number[] = []
    for (const part of page.parts) {
      const item = at(at(flow.sections, part.section).items, part.item)
      const partSection = at(model.sections, part.section)
      const partCtx = { ...pageCtx, width: columnWidth(partSection) }
      const node =
        part.rows && item.block.kind === 'table'
          ? renderTable(item.block, partCtx, { rows: part.rows, repeat: part.repeat ?? 0 })
          : renderBlock(item.block, partCtx, `${ctx.id}-${item.key}`)
      if (!part.rows || part.rows[0] === 0) notes.push(...item.footnotes)
      const last = regions.at(-1)
      if (last?.section === part.section) last.nodes.push(node)
      else regions.push({ section: part.section, nodes: [node] })
    }
    const header = pick(at(headers, page.section), page, model)
    const footer = pick(at(footers, page.section), page, model)
    const left = margin.left + margin.gutter
    return h(
      'article',
      {
        key: index,
        'data-docx-page': page.number,
        'data-docx-blank': page.blank ? '' : undefined,
        'aria-label': `Page ${index + 1} of ${pages.length}`,
        style: {
          position: 'relative',
          width: pt(width * scale),
          height: pt(height * scale),
          margin: '0 auto 16px',
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
        },
      },
      h(
        'div',
        {
          'data-docx-sheet': '',
          style: {
            ...sheetStyle(model),
            position: 'absolute',
            top: 0,
            left: 0,
            width: pt(width),
            height: pt(height),
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: '0 0',
          },
        },
        [
          header
            ? h(
                'header',
                {
                  'data-docx-header': '',
                  style: { position: 'absolute', top: pt(margin.header), left: pt(left), right: pt(margin.right) },
                },
                renderBlocks(header, pageCtx),
              )
            : null,
          h(
            'div',
            {
              'data-docx-body': '',
              style: {
                position: 'absolute',
                top: pt(margin.top),
                bottom: pt(margin.bottom),
                left: pt(left),
                right: pt(margin.right),
                display: 'flex',
                flexDirection: 'column',
              },
            },
            [
              ...regions.map((region) => {
                const columns = at(model.sections, region.section).columns
                return h(
                  'div',
                  {
                    'data-docx-region': region.section,
                    style:
                      columns && columns.count > 1
                        ? {
                            columnCount: columns.count,
                            columnGap: pt(columns.space),
                            columnRule: columns.separator ? '0.5pt solid currentColor' : undefined,
                          }
                        : undefined,
                  },
                  region.nodes,
                )
              }),
              renderFootnotes(notes, pageCtx),
            ],
          ),
          footer
            ? h(
                'footer',
                {
                  'data-docx-footer': '',
                  style: { position: 'absolute', bottom: pt(margin.footer), left: pt(left), right: pt(margin.right) },
                },
                renderBlocks(footer, pageCtx),
              )
            : null,
        ],
      ),
    )
  })
}
