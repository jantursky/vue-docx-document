import type { ListFormat, PageNumberFormat } from '../components/types'

const ROMAN: [number, string][] = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
]

const roman = (value: number): string => {
  let rest = value
  let out = ''
  for (const [amount, digits] of ROMAN) {
    while (rest >= amount) {
      out += digits
      rest -= amount
    }
  }
  return out
}

/** Word's letters: a … z, then aa … zz, then aaa. */
const letter = (value: number): string => {
  const char = String.fromCharCode(97 + ((value - 1) % 26))
  return char.repeat(Math.floor((value - 1) / 26) + 1)
}

/** A number as Word writes it in a list or a page number field. */
export const formatNumber = (value: number, format: ListFormat | PageNumberFormat = 'decimal'): string => {
  if (value < 1 && format !== 'decimal') return String(value)
  switch (format) {
    case 'lowerRoman':
      return roman(value)
    case 'upperRoman':
      return roman(value).toUpperCase()
    case 'lowerLetter':
      return letter(value)
    case 'upperLetter':
      return letter(value).toUpperCase()
    default:
      return String(value)
  }
}
