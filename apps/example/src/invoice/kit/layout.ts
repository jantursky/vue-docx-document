/** A page is A4 with 40 pt margins on the sides; both kits lay out inside this width. */
export const PAGE = { width: 595.28, height: 841.89, margin: 40 } as const
export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2

/** Splits `Page {page} of {total}` into text and page-number parts. */
export const pageParts = (template: string): (string | { number: 'page' | 'total' })[] =>
  template
    .split(/(\{page\}|\{total\})/)
    .filter(Boolean)
    .map((part) => (part === '{page}' ? { number: 'page' } : part === '{total}' ? { number: 'total' } : part))
