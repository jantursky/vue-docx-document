/** Small validators for parsing JSON that a user brings: drafts in storage and imported files. */

export type Raw = Record<string, unknown>

export const isRaw = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isIsoDate = (value: string) =>
  value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))

/** Reads `source[key]`: the fallback when the key is missing, `undefined` when the value is wrong. */
export const field = <T>(
  source: Raw,
  key: string,
  fallback: T,
  valid: (value: unknown) => value is T,
): T | undefined => {
  if (!(key in source) || source[key] === undefined) return fallback
  return valid(source[key]) ? source[key] : undefined
}

export const isString = (value: unknown): value is string => typeof value === 'string'
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
export const isNumber =
  (min: number, max = Infinity) =>
  (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
export const isOneOf =
  <T extends string>(options: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === 'string' && options.includes(value as T)

/** Reads every key of `fallback` from `source`, or `undefined` when one is wrong. */
export const record = <T extends object>(
  source: unknown,
  fallback: T,
  valid: { [K in keyof T]: (value: unknown) => value is T[K] },
  /** Every key must be present, with no fallbacks. */
  complete = false,
): T | undefined => {
  if (!isRaw(source)) return undefined
  if (complete && !Object.keys(fallback).every((key) => key in source)) return undefined
  const result: Partial<T> = {}
  for (const key of Object.keys(fallback) as (keyof T & string)[]) {
    const value = field(source, key, fallback[key], valid[key])
    if (value === undefined) return undefined
    result[key] = value
  }
  return result as T
}

export const isDate = (value: unknown): value is string => typeof value === 'string' && isIsoDate(value)
export const strings = <T extends object>(sample: T) =>
  Object.fromEntries(Object.keys(sample).map((key) => [key, isString])) as {
    [K in keyof T]: (value: unknown) => value is T[K]
  }
