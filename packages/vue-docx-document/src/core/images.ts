import type { ImageSource, ImageType } from '../components/types'
import { PT_PER_IN, PX_PER_IN, round } from './units'

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024

// Typed this way so a call narrows like a `throw`.
const fail: (message: string) => never = (message) => {
  throw new Error(`[vue-docx-document] ${message}`)
}

const describe = (src: string): string => (src.length > 60 ? `${src.slice(0, 57)}...` : src)

const decodeDataUri = (uri: string): Uint8Array => {
  const comma = uri.indexOf(',')
  if (comma === -1) fail(`The data URI "${describe(uri)}" has no data.`)
  const header = uri.slice(5, comma)
  const data = uri.slice(comma + 1)
  if (!/;base64$/i.test(header)) {
    try {
      return new TextEncoder().encode(decodeURIComponent(data))
    } catch {
      return fail(`The data URI "${describe(uri)}" is not valid percent-encoding.`)
    }
  }
  try {
    const binary = atob(data.replace(/\s/g, ''))
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return fail(`The data URI "${describe(uri)}" is not valid base64.`)
  }
}

const readCapped = async (response: Response, url: string): Promise<Uint8Array> => {
  const tooLarge = (): never => fail(`The image at ${url} is larger than 20 MB.`)
  if (Number(response.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) tooLarge()
  const reader = response.body?.getReader()
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    return bytes.length > MAX_IMAGE_BYTES ? tooLarge() : bytes
  }
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel()
      tooLarge()
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

const fetchImage = async (url: string): Promise<Uint8Array> => {
  let response: Response
  try {
    response = await fetch(url, { redirect: 'error' })
  } catch (error) {
    return fail(`Couldn't load the image at ${url}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!response.ok) fail(`Couldn't load the image at ${url}: HTTP ${response.status}.`)
  return readCapped(response, url)
}

/** Images fetched during one render, by URL, so an image used twice downloads once. */
export type ImageCache = Map<string, Promise<Uint8Array>>

const resolveUrl = (src: string): URL => {
  try {
    return new URL(src, typeof location === 'undefined' ? undefined : location.href)
  } catch {
    return fail(`"${describe(src)}" is not an image URL or data URI.`)
  }
}

/** Reads the bytes of an image source: a data URI, an http(s) URL, or the bytes themselves. */
export const loadImage = async (src: ImageSource, cache: ImageCache): Promise<Uint8Array> => {
  if (src instanceof Uint8Array) return src
  if (src instanceof ArrayBuffer) return new Uint8Array(src)
  if (typeof Blob !== 'undefined' && src instanceof Blob) return new Uint8Array(await src.arrayBuffer())
  if (typeof src !== 'string')
    return fail('An image src must be a data URI, a URL, a Uint8Array, an ArrayBuffer or a Blob.')
  if (/^data:/i.test(src)) return decodeDataUri(src)
  const url = resolveUrl(src)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`Images load from http(s) URLs and data URIs only, not "${url.protocol}".`)
  }
  let pending = cache.get(url.href)
  if (!pending) {
    pending = fetchImage(url.href)
    cache.set(url.href, pending)
  }
  return pending
}

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length))

/** The image type from its first bytes, or undefined if it's none of the ones Word takes. */
export const sniffType = (bytes: Uint8Array): ImageType | undefined => {
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (ascii(bytes, 0, 4) === 'GIF8') return 'gif'
  if (ascii(bytes, 0, 2) === 'BM') return 'bmp'
  if (/^\uFEFF?\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(svgHead(bytes))) {
    return 'svg'
  }
  return undefined
}

const svgHead = (bytes: Uint8Array): string => new TextDecoder().decode(bytes.subarray(0, 4096))

/** CSS px from an SVG length attribute, or undefined for percentages and anything unreadable. */
const svgLength = (value: string | undefined): number | undefined => {
  const match = value ? /^\s*(\d*\.?\d+)\s*(px|pt|in|cm|mm)?\s*$/i.exec(value) : null
  if (!match) return undefined
  const perInch: Record<string, number | undefined> = { px: PX_PER_IN, pt: PT_PER_IN, in: 1, cm: 2.54, mm: 25.4 }
  return (Number(match[1]) / (perInch[(match[2] ?? 'px').toLowerCase()] ?? PX_PER_IN)) * PX_PER_IN
}

const svgSize = (bytes: Uint8Array): { width: number; height: number } | undefined => {
  const tag = /<svg[\s>][^>]*>/i.exec(new TextDecoder().decode(bytes))?.[0]
  if (!tag) return undefined
  const attribute = (name: string): string | undefined =>
    new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1]
  const box = attribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  const [, , boxWidth, boxHeight] = box?.length === 4 && box.every(Number.isFinite) ? box : []
  let width = svgLength(attribute('width'))
  let height = svgLength(attribute('height'))
  if (boxWidth && boxHeight) {
    width ??= height !== undefined ? (height * boxWidth) / boxHeight : boxWidth
    height ??= (width * boxHeight) / boxWidth
  }
  return width && height ? { width, height } : undefined
}

/** The EXIF orientation in an APP1 segment whose data starts at `start`; 1 when there's none. */
const exifOrientation = (bytes: Uint8Array, view: DataView, start: number): number => {
  if (ascii(bytes, start, 6) !== 'Exif\0\0') return 1
  const tiff = start + 6
  const little = ascii(bytes, tiff, 2) === 'II'
  const directory = tiff + view.getUint32(tiff + 4, little)
  const count = view.getUint16(directory, little)
  for (let index = 0; index < count; index++) {
    const entry = directory + 2 + index * 12
    if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little)
  }
  return 1
}

const jpegSize = (bytes: Uint8Array): { width: number; height: number } | undefined => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let orientation = 1
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return undefined
    const marker = bytes[offset + 1] ?? 0
    if (marker === 0xe1) orientation = exifOrientation(bytes, view, offset + 4)
    // SOF0 to SOF15 carry the frame size; C4, C8 and CC are other segments in that range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const width = view.getUint16(offset + 7)
      const height = view.getUint16(offset + 5)
      // Orientations 5 to 8 turn the picture a quarter, as Word and browsers show it.
      return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height }
    }
    offset += 2 + view.getUint16(offset + 2)
  }
  return undefined
}

/** The intrinsic size in CSS px, read from the file header. */
export const intrinsicSize = (bytes: Uint8Array, type: ImageType): { width: number; height: number } | undefined => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const size = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : undefined)
  try {
    switch (type) {
      case 'png':
        return size(view.getUint32(16), view.getUint32(20))
      case 'gif':
        return size(view.getUint16(6, true), view.getUint16(8, true))
      case 'bmp':
        // Bottom-up bitmaps store a negative height.
        return size(Math.abs(view.getInt32(18, true)), Math.abs(view.getInt32(22, true)))
      case 'jpg':
        return jpegSize(bytes)
      case 'svg':
        return svgSize(bytes)
    }
  } catch {
    // A truncated header reads past the end; the size is unknown then.
    return undefined
  }
}

/**
 * The display size in points. Both sides given: as is. One: the other from the aspect ratio.
 * None: the intrinsic size at 96 dpi.
 */
export const fitImage = (
  intrinsic: { width: number; height: number } | undefined,
  width: number | undefined,
  height: number | undefined,
): { width: number; height: number } => {
  if (width !== undefined && height !== undefined) return { width, height }
  if (!intrinsic) {
    return fail("Can't read the size of an image; give it a width and a height.")
  }
  const ratio = intrinsic.width / intrinsic.height
  if (width !== undefined) return { width, height: round(width / ratio) }
  if (height !== undefined) return { width: round(height * ratio), height }
  const toPt = (px: number) => round((px * PT_PER_IN) / PX_PER_IN)
  return { width: toPt(intrinsic.width), height: toPt(intrinsic.height) }
}
