import type { BorderSide, HeadingLevel, Length, ParagraphStyle, RunStyle, Sides, TabStop } from '../components/types'
import { optionalColor, toColor } from './colors'
import { DEFAULT_BORDER } from './defaults'
import type { BorderModel, ParagraphStyleModel, RunStyleModel, SidesModel } from './model'
import { optionalPoints, toPoints } from './units'

// Props to model pieces: lengths to points, colors to `#rrggbb`, undefined keys left out.

type Props = object

const SIDES = ['top', 'right', 'bottom', 'left'] as const

/** Drops undefined values, so spreading a result never clears an inherited one. */
export const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T

const flag = (value: unknown): boolean | undefined => (value === undefined ? undefined : value !== false)

/** The run formatting an element sets itself. */
export const runStyle = (props: Props): RunStyleModel => {
  const style = props as RunStyle
  return defined({
    bold: flag(style.bold),
    italic: flag(style.italic),
    underline: typeof style.underline === 'string' ? style.underline : style.underline ? 'single' : undefined,
    strike: flag(style.strike),
    doubleStrike: flag(style.doubleStrike),
    color: optionalColor(style.color),
    highlight: style.highlight,
    shading: optionalColor(style.shading),
    font: style.font,
    size: style.size,
    superscript: flag(style.superscript),
    subscript: flag(style.subscript),
    allCaps: flag(style.allCaps),
    smallCaps: flag(style.smallCaps),
    characterSpacing: optionalPoints(style.characterSpacing),
  })
}

/** Applies an element's run formatting over what it inherits. Nearest wins; `underline: false` clears it. */
export const cascade = (inherited: RunStyleModel, props: Props): RunStyleModel => {
  const next = { ...inherited, ...runStyle(props) }
  if ((props as RunStyle).underline === false) delete next.underline
  return next
}

export const border = (side: BorderSide): BorderModel => ({
  style: side.style ?? DEFAULT_BORDER.style,
  size: side.size ?? DEFAULT_BORDER.size,
  color: side.color === undefined ? DEFAULT_BORDER.color : toColor(side.color),
  space: side.space ?? DEFAULT_BORDER.space,
})

export const borderSides = (sides: Sides<BorderSide> | undefined): SidesModel<BorderModel> | undefined => {
  if (!sides) return undefined
  const out: SidesModel<BorderModel> = {}
  for (const side of SIDES) if (sides[side]) out[side] = border(sides[side])
  return out
}

/** One length for every side, or a length per side. */
export const lengthSides = (value: Length | Sides<Length> | undefined): SidesModel<number> | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'object') {
    const all = toPoints(value)
    return { top: all, right: all, bottom: all, left: all }
  }
  return defined({
    top: optionalPoints(value.top),
    right: optionalPoints(value.right),
    bottom: optionalPoints(value.bottom),
    left: optionalPoints(value.left),
  })
}

const tabStop = (stop: TabStop): NonNullable<ParagraphStyleModel['tabStops']>[number] => ({
  position: toPoints(stop.position),
  type: stop.type ?? 'left',
  leader: stop.leader ?? 'none',
})

/** `heading` as a template may write it: `1`, `'1'` or `'title'`. */
export const headingLevel = (value: unknown): HeadingLevel | undefined => {
  if (value === undefined) return undefined
  if (value === 'title') return 'title'
  const level = Number(value)
  if (Number.isInteger(level) && level >= 1 && level <= 6) return level as HeadingLevel
  throw new Error(`[vue-docx-document] heading=${JSON.stringify(value)} is not a heading level. Use 'title' or 1 to 6.`)
}

/** The paragraph formatting an element sets itself. */
export const paragraphStyle = (props: Props): ParagraphStyleModel => {
  const style = props as ParagraphStyle & { heading?: unknown; styleId?: string }
  const indent = defined({
    left: optionalPoints(style.indent),
    right: optionalPoints(style.indentRight),
    firstLine: optionalPoints(style.firstLine),
    hanging: optionalPoints(style.hanging),
  })
  return defined({
    heading: headingLevel(style.heading),
    styleId: style.styleId,
    align: style.align,
    spaceBefore: optionalPoints(style.spaceBefore),
    spaceAfter: optionalPoints(style.spaceAfter),
    lineHeight: style.lineHeight,
    indent: Object.keys(indent).length > 0 ? indent : undefined,
    keepNext: flag(style.keepNext),
    keepLines: flag(style.keepLines),
    pageBreakBefore: flag(style.pageBreakBefore),
    border: borderSides(style.border),
    background: optionalColor(style.background),
    tabStops: style.tabStops?.map(tabStop),
  })
}
