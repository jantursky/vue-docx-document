/** The 16 basic CSS color names. */
const NAMED: Record<string, string> = {
  black: '#000000',
  silver: '#c0c0c0',
  gray: '#808080',
  white: '#ffffff',
  maroon: '#800000',
  red: '#ff0000',
  purple: '#800080',
  fuchsia: '#ff00ff',
  green: '#008000',
  lime: '#00ff00',
  olive: '#808000',
  yellow: '#ffff00',
  navy: '#000080',
  blue: '#0000ff',
  teal: '#008080',
  aqua: '#00ffff',
}

/** Normalizes `#rgb`, `#rrggbb`, `rrggbb` or a basic color name to lowercase `#rrggbb`. Throws on anything else. */
export const toColor = (value: unknown): string => {
  if (typeof value === 'string') {
    const color = value.trim().toLowerCase()
    const named = NAMED[color]
    if (named) return named
    const hex = color.replace(/^#/, '')
    if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`
    if (/^[0-9a-f]{3}$/.test(hex) && color.startsWith('#')) {
      return `#${hex.replace(/./g, (digit) => digit + digit)}`
    }
  }
  throw new Error(
    `[vue-docx-document] "${String(value)}" is not a color. Use #rgb, #rrggbb, rrggbb or a basic CSS color name.`,
  )
}

/** `toColor` for optional values. */
export const optionalColor = (value: unknown): string | undefined => (value == null ? undefined : toColor(value))
