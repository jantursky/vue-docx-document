/** What a warning is about. Match on these rather than on the wording, which may change. */
export type WarningCode =
  'misplaced-element' | 'dropped-text' | 'missing-section' | 'image-failed' | 'unsafe-link' | 'missing-bookmark'

export interface DocxWarning {
  code: WarningCode
  message: string
  /** 1-based number of the `<Section>` it happened in. */
  section?: number
  /** The component it is about, such as `<TableRow>`. */
  element?: string
}

export interface DiagnosticOptions {
  /**
   * Receives every warning. Giving it also makes the render lenient: a misplaced element or an
   * image that fails to load is left out with a warning instead of rejecting the render.
   */
  onWarn?: (warning: DocxWarning) => void
  /**
   * `true` rejects the render on the first warning. `false` makes the render lenient, with
   * warnings going to `onWarn` or to `console.warn`. Left out, misplaced elements and failed
   * images reject the render, and other warnings go to `onWarn` or to `console.warn`.
   */
  strict?: boolean
}

/** The warnings of one render. */
export interface Reporter {
  /** Whether misplaced elements and failed images are reported and left out instead of thrown. */
  lenient: boolean
  warn(warning: DocxWarning): void
}

export const PREFIX = '[vue-docx-document]'

const where = ({ section, element }: Pick<DocxWarning, 'section' | 'element'>): string => {
  const parts = [section === undefined ? undefined : `section ${section}`, element].filter(Boolean)
  return parts.length > 0 ? ` (${parts.join(', ')})` : ''
}

/** A reporter for one render. Console warnings are deduplicated per render, not per process. */
export const createReporter = ({ onWarn, strict }: DiagnosticOptions = {}): Reporter => {
  const seen = new Set<string>()
  return {
    lenient: strict === false || (onWarn !== undefined && strict !== true),
    warn(warning) {
      if (strict) throw new Error(`${PREFIX} ${warning.code}: ${warning.message}${where(warning)}`)
      if (onWarn) {
        onWarn(warning)
        return
      }
      const text = `${PREFIX} ${warning.message}${where(warning)}`
      if (seen.has(text)) return
      seen.add(text)
      console.warn(text)
    },
  }
}
