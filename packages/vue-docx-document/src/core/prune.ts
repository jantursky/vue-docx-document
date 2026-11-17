import type { BlockModel, DocxModel, HeaderFooterSet, InlineModel, ParagraphModel } from './model'
import { defined } from './styles'

/** The model without the given inline items, wherever they sit. Their paragraphs stay. */
export const pruneInlines = (model: DocxModel, drop: ReadonlySet<InlineModel>): DocxModel => {
  const inlines = (items: InlineModel[]): InlineModel[] =>
    items.flatMap((item): InlineModel[] => {
      if (drop.has(item)) return []
      if (item.kind === 'link' || item.kind === 'bookmark') return [{ ...item, children: inlines(item.children) }]
      return [item]
    })
  const paragraph = (item: ParagraphModel): ParagraphModel => ({ ...item, children: inlines(item.children) })
  const blocks = (items: BlockModel[]): BlockModel[] =>
    items.map((item): BlockModel => {
      if (item.kind === 'paragraph') return paragraph(item)
      if (item.kind === 'toc') return item
      return {
        ...item,
        rows: item.rows.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => ({ ...cell, children: blocks(cell.children) })),
        })),
      }
    })
  const set = ({ default: main, first, even }: HeaderFooterSet): HeaderFooterSet =>
    defined({ default: main && blocks(main), first: first && blocks(first), even: even && blocks(even) })
  return {
    ...model,
    sections: model.sections.map((section) => ({
      ...section,
      headers: set(section.headers),
      footers: set(section.footers),
      children: blocks(section.children),
    })),
    footnotes: model.footnotes.map((note) => ({ ...note, children: note.children.map(paragraph) })),
  }
}
