import type { BlockModel, DocxModel, InlineModel, ParagraphModel, SectionModel } from '../core/model'
import { formatNumber } from './format'
import { at } from './at'

// The model as a sequence of blocks to lay out on pages: paragraphs split at page breaks,
// list markers counted, footnotes and headings found.

export interface FlowItem {
  key: string
  block: BlockModel
  /** Starts a new page: after a page break, or from `pageBreakBefore`. */
  breakBefore: boolean
  keepNext: boolean
  /** Ids of the footnotes referenced in the block, which go at the bottom of its page. */
  footnotes: number[]
}

export interface FlowSection {
  section: SectionModel
  items: FlowItem[]
}

export interface Heading {
  key: string
  level: number
  text: string
}

export interface Flow {
  sections: FlowSection[]
  /** The marker of each list paragraph, such as `2.` or `•`. */
  markers: WeakMap<ParagraphModel, string>
  /** Body headings in order, for a table of contents. */
  headings: Heading[]
}

export const plainText = (items: InlineModel[]): string =>
  items
    .map((item) => {
      if (item.kind === 'text') return item.text
      if (item.kind === 'link' || item.kind === 'bookmark') return plainText(item.children)
      if (item.kind === 'tab') return ' '
      return ''
    })
    .join('')

const footnotesIn = (block: BlockModel): number[] => {
  const ids: number[] = []
  const visit = (items: InlineModel[]): void => {
    for (const item of items) {
      if (item.kind === 'footnote') ids.push(item.id)
      else if (item.kind === 'link' || item.kind === 'bookmark') visit(item.children)
    }
  }
  const visitBlocks = (blocks: BlockModel[]): void => {
    for (const child of blocks) {
      if (child.kind === 'paragraph') visit(child.children)
      else if (child.kind === 'table')
        for (const row of child.rows) for (const cell of row.cells) visitBlocks(cell.children)
    }
  }
  visitBlocks([block])
  return ids
}

/** Counts list items in document order and writes each one's marker. */
const countMarkers = (model: DocxModel): WeakMap<ParagraphModel, string> => {
  const markers = new WeakMap<ParagraphModel, string>()
  const lists = new Map(model.lists.map((list) => [list.id, list]))
  const counters = new Map<string, (number | undefined)[]>()
  const visit = (blocks: BlockModel[]): void => {
    for (const block of blocks) {
      if (block.kind === 'table') {
        for (const row of block.rows) for (const cell of row.cells) visit(cell.children)
      }
      if (block.kind !== 'paragraph' || !block.style.list) continue
      const { id, level } = block.style.list
      const list = lists.get(id)
      if (!list) continue
      const counts = counters.get(id) ?? []
      counters.set(id, counts)
      const { format, text, start } = at(list.levels, level)
      counts[level] = (counts[level] ?? start - 1) + 1
      // A higher level restarts the ones below it, as Word does.
      counts.length = level + 1
      markers.set(
        block,
        format === 'bullet'
          ? text
          : text.replace(/%(\d)/g, (_, digit: string) => {
              const index = Number(digit) - 1
              const levelModel = list.levels[index]
              if (!levelModel) return ''
              const value = counts[index] ?? levelModel.start
              return formatNumber(value, levelModel.format === 'bullet' ? 'decimal' : levelModel.format)
            }),
      )
    }
  }
  for (const section of model.sections) {
    for (const set of [section.headers, section.footers])
      for (const blocks of Object.values(set) as BlockModel[][]) visit(blocks)
    visit(section.children)
  }
  for (const note of model.footnotes) visit(note.children)
  return markers
}

/** A paragraph's content between its page breaks. */
const splitAtPageBreaks = (paragraph: ParagraphModel): InlineModel[][] => {
  const groups: InlineModel[][] = []
  let group: InlineModel[] = []
  for (const item of paragraph.children) {
    if (item.kind === 'pageBreak') {
      groups.push(group)
      group = []
    } else group.push(item)
  }
  groups.push(group)
  return groups
}

export const buildFlow = (model: DocxModel): Flow => {
  const markers = countMarkers(model)
  const headings: Heading[] = []
  const sections = model.sections.map((section, sectionIndex): FlowSection => {
    const items: FlowItem[] = []
    let pendingBreak = false
    section.children.forEach((block, blockIndex) => {
      if (block.kind !== 'paragraph') {
        items.push({
          key: `${sectionIndex}.${blockIndex}`,
          block,
          breakBefore: pendingBreak,
          keepNext: false,
          footnotes: footnotesIn(block),
        })
        pendingBreak = false
        return
      }
      const look = block.style.heading === undefined ? undefined : model.headings[block.style.heading]
      const groups = splitAtPageBreaks(block)
      groups.forEach((children, index) => {
        if (index > 0) pendingBreak = true
        // Around a page break, an empty piece only carried the break.
        if (children.length === 0 && groups.length > 1) return
        let paragraph = block
        if (groups.length > 1) {
          // Only the first piece keeps the list marker; the rest continue the item.
          const { list: _list, ...rest } = block.style
          paragraph = { ...block, style: index === 0 ? block.style : rest, children }
          const marker = markers.get(block)
          if (index === 0 && marker !== undefined) markers.set(paragraph, marker)
        }
        const key = `${sectionIndex}.${blockIndex}.${index}`
        items.push({
          key,
          block: paragraph,
          breakBefore: pendingBreak || (index === 0 && Boolean(block.style.pageBreakBefore)),
          keepNext: block.style.keepNext ?? look?.keepNext ?? false,
          footnotes: footnotesIn(paragraph),
        })
        pendingBreak = false
        if (typeof block.style.heading === 'number' && index === 0) {
          // A numbered heading, from <ListItem heading>, is listed with its number, as Word does.
          const marker = markers.get(block)
          const text = plainText(block.children)
          headings.push({ key, level: block.style.heading, text: marker === undefined ? text : `${marker} ${text}` })
        }
      })
    })
    return { section, items }
  })
  return { sections, markers, headings }
}
