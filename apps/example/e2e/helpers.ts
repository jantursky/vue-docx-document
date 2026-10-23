import { readFile } from 'node:fs/promises'

import { expect, type Download, type Locator, type Page } from '@playwright/test'
import JSZip from 'jszip'

/** Fails the test on uncaught errors and console errors. */
export const watchErrors = (page: Page): string[] => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

/**
 * Waits for the download with this file name. Headless Chromium has no PDF viewer, so
 * every preview frame that loads a PDF also shows up as a download, named after the blob.
 */
export const waitForDownload = (page: Page, fileName: string): Promise<Download> =>
  page.waitForEvent('download', (download) => download.suggestedFilename() === fileName)

/** Clicks `trigger` and returns the download with this file name. */
export const download = async (page: Page, fileName: string, trigger: Locator): Promise<Download> => {
  const [file] = await Promise.all([waitForDownload(page, fileName), trigger.click()])
  return file
}

const decode = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

export interface DocxFile {
  /** The text of each paragraph in `word/document.xml`, runs joined. */
  paragraphs: string[]
  /** `word/document.xml` as it is. */
  xml: string
  /** Names of the files in the package, without directories. */
  files: string[]
  /** Reads another file of the package as text. */
  read: (name: string) => Promise<string>
}

/** Opens a downloaded .docx, which is a zip, and reads its main document. */
export const readDocx = async (file: Download): Promise<DocxFile> => {
  const zip = await JSZip.loadAsync(await readFile(await file.path()))
  const xml = await zip.file('word/document.xml')!.async('string')
  const paragraphs = xml
    .split('</w:p>')
    .map((part) => [...part.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(([, text]) => decode(text!)).join(''))
  return {
    paragraphs,
    xml,
    files: Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name),
    read: (name) => zip.file(name)!.async('string'),
  }
}

/** The first bytes of a downloaded file, as text. */
export const readHeader = async (file: Download, length = 5): Promise<string> =>
  (await readFile(await file.path())).subarray(0, length).toString('latin1')

/** The blob URL a PDF viewer's frame currently shows, once it has one. */
export const frameSrc = async (viewer: Locator): Promise<string> => {
  const frame = viewer.locator('[data-pdf-viewer-frame]')
  await expect(frame).toHaveAttribute('src', /^blob:/)
  return (await frame.getAttribute('src')) ?? ''
}

/** Fetches a blob URL inside the page and returns the PDF as latin1 text. */
export const readPdfText = (page: Page, url: string): Promise<string> =>
  page.evaluate(async (src) => {
    const bytes = new Uint8Array(await (await fetch(src)).arrayBuffer())
    return new TextDecoder('latin1').decode(bytes)
  }, url)
