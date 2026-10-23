import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, effectScope, h } from 'vue'

import {
  Document,
  DOCX_MIME,
  DocxPreview,
  Image,
  Paragraph,
  Section,
  Table,
  TableCell,
  TableRow,
  renderToBlob,
  renderToModel,
  useDocx,
} from '../../src'

const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwQZYAwAZ+sH+XZ+7a0AAAAASUVORK5CYII='),
  (char) => char.charCodeAt(0),
)

const header = async (blob: Blob) => [...new Uint8Array(await blob.slice(0, 2).arrayBuffer())]

const Simple = defineComponent(
  () => () => h(Document, { title: 'Browser' }, () => h(Section, null, () => h(Paragraph, null, () => 'Hello'))),
)

const mountPreview = (document: ReturnType<typeof defineComponent>) => {
  const host = window.document.createElement('div')
  window.document.body.append(host)
  const app = createApp({ render: () => h(DocxPreview, { document, debounce: 0 }) })
  app.mount(host)
  return {
    host,
    pages: () => [...host.querySelectorAll<HTMLElement>('[data-docx-page]')],
    unmount: () => {
      app.unmount()
      host.remove()
    },
  }
}

describe('in a real browser', () => {
  it('writes a .docx Blob', async () => {
    const blob = await renderToBlob(Simple)
    expect(blob.type).toBe(DOCX_MIME)
    expect(blob.size).toBeGreaterThan(3000)
    expect(await header(blob)).toEqual([0x50, 0x4b])
  })

  it('loads images from a Blob and a data URI', async () => {
    const dataUri = `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`
    const model = await renderToModel(
      defineComponent(
        () => () =>
          h(Document, null, () =>
            h(Section, null, () => [
              h(Image, { src: new Blob([PNG], { type: 'image/png' }), width: 40 }),
              h(Image, { src: dataUri }),
            ]),
          ),
      ),
    )
    const images = model.sections[0]!.children.map((block) =>
      block.kind === 'paragraph' ? block.children[0] : undefined,
    )
    expect(images).toMatchObject([
      { kind: 'image', type: 'png', width: 40, height: 20 },
      { kind: 'image', type: 'png', width: 1.5, height: 0.75 },
    ])
  })

  it('gives useDocx an object URL the browser can fetch', async () => {
    const scope = effectScope()
    const { url, loading } = scope.run(() => useDocx(Simple, undefined, { debounce: 0 }))!
    await expect.poll(() => loading.value, { timeout: 15_000 }).toBe(false)
    const response = await fetch(url.value!)
    expect(await header(await response.blob())).toEqual([0x50, 0x4b])
    scope.stop()
  })

  it('paginates long content in the preview', async () => {
    const Long = defineComponent(
      () => () =>
        h(Document, null, () =>
          h(Section, null, () =>
            Array.from({ length: 80 }, (_, index) =>
              h(Paragraph, null, () => `Paragraph ${index + 1} with a few words.`),
            ),
          ),
        ),
    )
    const preview = mountPreview(Long)
    await expect.poll(() => preview.pages().length, { timeout: 10_000 }).toBeGreaterThan(1)
    const pages = preview.pages()
    for (const page of pages) {
      const body = page.querySelector<HTMLElement>('[data-docx-body]')!
      const last = body.lastElementChild!.lastElementChild as HTMLElement
      // Nothing runs past the bottom margin.
      expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(body.getBoundingClientRect().bottom + 1)
    }
    expect(pages.at(-1)!.textContent).toContain('Paragraph 80')
    preview.unmount()
  })

  it('splits a long table between rows and repeats its header row', async () => {
    const Rows = defineComponent(
      () => () =>
        h(Document, null, () =>
          h(Section, null, () =>
            h(Table, null, () => [
              h(TableRow, { header: true }, () => [
                h(TableCell, null, () => 'Item'),
                h(TableCell, null, () => 'Price'),
              ]),
              ...Array.from({ length: 70 }, (_, index) =>
                h(TableRow, null, () => [h(TableCell, null, () => `Row ${index + 1}`), h(TableCell, null, () => '10')]),
              ),
            ]),
          ),
        ),
    )
    const preview = mountPreview(Rows)
    await expect.poll(() => preview.pages().length, { timeout: 10_000 }).toBeGreaterThan(1)
    for (const page of preview.pages()) {
      expect(page.querySelector('tr')!.textContent).toBe('ItemPrice')
    }
    expect(preview.pages().at(-1)!.textContent).toContain('Row 70')
    preview.unmount()
  })
})
