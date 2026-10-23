/** Points as a number, or a string with a unit: `12pt`, `16px`, `1in`, `2.5cm`, `20mm`. */
export type Length = number | `${number}${'pt' | 'px' | 'in' | 'cm' | 'mm'}`

export const PT_PER_IN = 72
export const PX_PER_IN = 96

const PER_INCH: Record<string, number> = { pt: PT_PER_IN, px: PX_PER_IN, in: 1, cm: 2.54, mm: 25.4 }

const pattern = /^(-?\d*\.?\d+(?:e-?\d+)?)\s*(pt|px|in|cm|mm)$/i

/** Converts a length to points. Throws on a string it can't read. */
export const toPoints = (length: Length): number => {
  if (typeof length === 'number' && Number.isFinite(length)) return length
  const match = typeof length === 'string' ? pattern.exec(length.trim()) : null
  if (!match) {
    throw new Error(
      `[vue-docx-document] "${String(length)}" is not a length. Use a number of points or a string such as "12pt", "1in", "2.5cm".`,
    )
  }
  const [, amount, unit = 'pt'] = match
  return round((Number(amount) / (PER_INCH[unit.toLowerCase()] ?? PT_PER_IN)) * PT_PER_IN)
}

/** `toPoints` for optional values. */
export const optionalPoints = (length: Length | undefined): number | undefined =>
  length === undefined ? undefined : toPoints(length)

/** Rounds to 1/1000 pt, so values from cm and mm stay readable. */
export const round = (value: number): number => Math.round(value * 1000) / 1000
