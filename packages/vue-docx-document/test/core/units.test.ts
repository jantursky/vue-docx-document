import { describe, expect, it } from 'vitest'

import { toPoints, type Length } from '../../src'
import { toColor } from '../../src/core/colors'

describe('toPoints', () => {
  it('reads numbers as points and converts units', () => {
    expect(toPoints(12)).toBe(12)
    expect(toPoints('12pt')).toBe(12)
    expect(toPoints('96px')).toBe(72)
    expect(toPoints('1in')).toBe(72)
    expect(toPoints('2.54cm')).toBe(72)
    expect(toPoints('25.4mm')).toBe(72)
    expect(toPoints(' 1.5IN ' as Length)).toBe(108)
    expect(toPoints('-1in')).toBe(-72)
  })

  it('throws on anything else', () => {
    expect(() => toPoints('12' as Length)).toThrow('[vue-docx-document] "12" is not a length')
    expect(() => toPoints('1em' as Length)).toThrow('is not a length')
    expect(() => toPoints(Number.NaN)).toThrow('is not a length')
  })
})

describe('toColor', () => {
  it('normalizes hex and basic names to lowercase #rrggbb', () => {
    expect(toColor('#F35815')).toBe('#f35815')
    expect(toColor('f35815')).toBe('#f35815')
    expect(toColor('#abc')).toBe('#aabbcc')
    expect(toColor(' Navy ')).toBe('#000080')
    expect(toColor('aqua')).toBe('#00ffff')
  })

  it('throws on anything else', () => {
    for (const bad of ['abc', '#abcd', 'rebeccapurple', 'rgb(0,0,0)', 12, undefined]) {
      expect(() => toColor(bad)).toThrow('is not a color')
    }
  })
})
