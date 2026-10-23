import { afterEach, describe, expect, it, vi } from 'vitest'

import { fitImage, intrinsicSize, loadImage, MAX_IMAGE_BYTES, sniffType } from '../../src/core/images'
import { PNG } from '../fixtures'

const bytes = (...values: number[]) => Uint8Array.from(values)
const text = (value: string) => new TextEncoder().encode(value)

const GIF = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 3, 0, 5, 0)
const BMP = (() => {
  const out = new Uint8Array(26)
  out.set([0x42, 0x4d])
  const view = new DataView(out.buffer)
  view.setInt32(18, 7, true)
  view.setInt32(22, -9, true)
  return out
})()
// SOI, an APP0 segment, then SOF0 with height 20 and width 40.
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 20, 0, 40, 3, 0, 0, 0)

/** A JPEG like the one above with an APP1 segment before the frame, holding one EXIF entry. */
const exifJpeg = (little: boolean, tag: number, value: number, signature = 'Exif\0\0'): Uint8Array => {
  const app1 = new Uint8Array(36)
  const view = new DataView(app1.buffer)
  app1.set([0xff, 0xe1, 0, 34, ...text(signature), ...text(little ? 'II' : 'MM')])
  view.setUint16(12, 42, little)
  view.setUint32(14, 8, little)
  view.setUint16(18, 1, little)
  view.setUint16(20, tag, little)
  view.setUint16(22, 3, little)
  view.setUint32(24, 1, little)
  view.setUint16(28, value, little)
  return Uint8Array.from([...JPEG.subarray(0, 2), ...app1, ...JPEG.subarray(2)])
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sniffType', () => {
  it('knows PNG, JPEG, GIF, BMP and SVG', () => {
    expect(sniffType(PNG)).toBe('png')
    expect(sniffType(JPEG)).toBe('jpg')
    expect(sniffType(GIF)).toBe('gif')
    expect(sniffType(BMP)).toBe('bmp')
    expect(sniffType(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('svg')
    expect(sniffType(text('﻿<?xml version="1.0"?>\n<!-- logo -->\n<svg viewBox="0 0 1 1"></svg>'))).toBe('svg')
    expect(sniffType(text('<html></html>'))).toBeUndefined()
  })
})

describe('intrinsicSize', () => {
  it('reads raster headers', () => {
    expect(intrinsicSize(PNG, 'png')).toEqual({ width: 2, height: 1 })
    expect(intrinsicSize(GIF, 'gif')).toEqual({ width: 3, height: 5 })
    expect(intrinsicSize(BMP, 'bmp')).toEqual({ width: 7, height: 9 })
    expect(intrinsicSize(JPEG, 'jpg')).toEqual({ width: 40, height: 20 })
  })

  it('turns JPEG sizes for EXIF orientations 5 to 8', () => {
    expect(intrinsicSize(exifJpeg(false, 0x0112, 6), 'jpg')).toEqual({ width: 20, height: 40 })
    expect(intrinsicSize(exifJpeg(true, 0x0112, 8), 'jpg')).toEqual({ width: 20, height: 40 })
    expect(intrinsicSize(exifJpeg(true, 0x0112, 3), 'jpg')).toEqual({ width: 40, height: 20 })
    expect(intrinsicSize(exifJpeg(true, 0x0110, 6), 'jpg')).toEqual({ width: 40, height: 20 })
    expect(intrinsicSize(exifJpeg(false, 0x0112, 6, 'http:\0'), 'jpg')).toEqual({ width: 40, height: 20 })
  })

  it('gives up on broken headers', () => {
    expect(intrinsicSize(bytes(0x89, 0x50), 'png')).toBeUndefined()
    expect(intrinsicSize(bytes(0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0), 'jpg')).toBeUndefined()
    expect(intrinsicSize(bytes(0xff, 0xd8), 'jpg')).toBeUndefined()
  })

  it('reads SVG width, height and viewBox', () => {
    const size = (svg: string) => intrinsicSize(text(svg), 'svg')
    expect(size('<svg width="100" height="50"/>')).toEqual({ width: 100, height: 50 })
    expect(size('<svg width="1in" height="72pt"/>')).toEqual({ width: 96, height: 96 })
    expect(size('<svg viewBox="0 0 200 100"/>')).toEqual({ width: 200, height: 100 })
    expect(size("<svg width='50' viewBox='0,0,200,100'/>")).toEqual({ width: 50, height: 25 })
    expect(size('<svg height="10" viewBox="0 0 200 100"/>')).toEqual({ width: 20, height: 10 })
    expect(size('<svg width="100%"/>')).toBeUndefined()
    expect(size('<nope/>')).toBeUndefined()
  })
})

describe('fitImage', () => {
  it('keeps both sides, fills one from the ratio, or uses 96 dpi', () => {
    expect(fitImage(undefined, 10, 20)).toEqual({ width: 10, height: 20 })
    expect(fitImage({ width: 200, height: 100 }, 50, undefined)).toEqual({ width: 50, height: 25 })
    expect(fitImage({ width: 200, height: 100 }, undefined, 50)).toEqual({ width: 100, height: 50 })
    expect(fitImage({ width: 96, height: 48 }, undefined, undefined)).toEqual({ width: 72, height: 36 })
    expect(() => fitImage(undefined, 10, undefined)).toThrow('give it a width and a height')
  })
})

describe('loadImage', () => {
  it('takes bytes, buffers, blobs and data URIs', async () => {
    expect(await loadImage(PNG, new Map())).toBe(PNG)
    expect(await loadImage(PNG.slice().buffer, new Map())).toEqual(PNG)
    expect(await loadImage(new Blob([PNG]), new Map())).toEqual(PNG)
    expect(await loadImage(`data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`, new Map())).toEqual(PNG)
    expect(new TextDecoder().decode(await loadImage('data:image/svg+xml,%3Csvg%2F%3E', new Map()))).toBe('<svg/>')
  })

  it('rejects bad data URIs, other schemes and other values', async () => {
    await expect(loadImage('data:image/png;base64', new Map())).rejects.toThrow('has no data')
    await expect(loadImage('data:image/png;base64,***', new Map())).rejects.toThrow('not valid base64')
    await expect(loadImage('data:image/svg+xml,%E0%A4%A', new Map())).rejects.toThrow(
      '[vue-docx-document] The data URI "data:image/svg+xml,%E0%A4%A" is not valid percent-encoding.',
    )
    await expect(loadImage('file:///etc/passwd', new Map())).rejects.toThrow('not "file:"')
    await expect(loadImage('javascript:alert(1)', new Map())).rejects.toThrow('http(s) URLs and data URIs only')
    await expect(loadImage({} as never, new Map())).rejects.toThrow('must be a data URI')
  })

  it('fetches http(s) URLs once per cache, refusing redirects, and caps their size', async () => {
    const fetch = vi.fn((url: string) => {
      if (url.includes('missing')) return Promise.resolve(new Response('', { status: 404 }))
      if (url.includes('offline')) return Promise.reject(new Error('network down'))
      if (url.includes('huge')) {
        return Promise.resolve(new Response('x', { headers: { 'content-length': String(MAX_IMAGE_BYTES + 1) } }))
      }
      if (url.includes('stream')) {
        const chunk = new Uint8Array(1024 * 1024)
        let sent = 0
        const stream = new Response(
          new ReadableStream({
            pull(controller) {
              sent++
              if (sent > 21) controller.close()
              else controller.enqueue(chunk)
            },
          }),
        )
        return Promise.resolve(stream)
      }
      return Promise.resolve(new Response(PNG.slice()))
    })
    vi.stubGlobal('fetch', fetch)
    const cache = new Map()
    expect(await loadImage('https://example.com/logo.png', cache)).toEqual(PNG)
    expect(await loadImage('https://example.com/logo.png', cache)).toEqual(PNG)
    expect(fetch).toHaveBeenCalledExactlyOnceWith('https://example.com/logo.png', { redirect: 'error' })
    await loadImage('https://example.com/logo.png', new Map())
    expect(fetch).toHaveBeenCalledTimes(2)
    await expect(loadImage('https://example.com/missing.png', new Map())).rejects.toThrow('HTTP 404')
    await expect(loadImage('https://example.com/offline.png', new Map())).rejects.toThrow('network down')
    await expect(loadImage('https://example.com/huge.png', new Map())).rejects.toThrow('larger than 20 MB')
    await expect(loadImage('https://example.com/stream.png', new Map())).rejects.toThrow('larger than 20 MB')
  })

  it('reads bodies without a stream', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      arrayBuffer: () => Promise.resolve(PNG.slice().buffer),
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(response)),
    )
    expect(await loadImage('https://example.com/plain.png', new Map())).toEqual(PNG)
    const big = { ...response, arrayBuffer: () => Promise.resolve(new ArrayBuffer(MAX_IMAGE_BYTES + 1)) }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(big)),
    )
    await expect(loadImage('https://example.com/big.png', new Map())).rejects.toThrow('larger than 20 MB')
  })
})
