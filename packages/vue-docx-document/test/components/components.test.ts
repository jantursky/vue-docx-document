import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { DocxDownloadButton, DocxPreview, Image, Paragraph, Section } from '../../src'
import Report from '../fixtures/Report.vue'
import { Names, PNG, singleSection } from '../fixtures'

const wrappers: { unmount: () => void }[] = []

const until = (condition: () => boolean) =>
  vi.waitFor(() => {
    if (!condition()) throw new Error('not yet')
  })

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('DocxPreview', () => {
  it('shows the loading slot, then pages', async () => {
    const wrapper = mount(DocxPreview, {
      props: { document: Report, documentProps: { title: 'Hello', points: ['A'] } },
      slots: { loading: 'Rendering…' },
    })
    wrappers.push(wrapper)
    expect(wrapper.text()).toBe('Rendering…')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    await until(() => wrapper.find('[data-docx-page]').exists())
    expect(wrapper.attributes('aria-label')).toBe('Document preview')
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
    expect(wrapper.find('[data-docx-page]').attributes('aria-label')).toBe('Page 1 of 1')
    expect(wrapper.find('[data-docx-footer]').text()).toBe('Page 1')
    expect(wrapper.find('[data-docx-heading="title"]').text()).toBe('Hello')
  })

  it('follows document props and scales pages', async () => {
    const wrapper = mount(DocxPreview, {
      props: {
        document: Report,
        documentProps: { title: 'First', points: [] },
        debounce: 0,
        scale: 0.5,
        label: 'Report',
      },
    })
    wrappers.push(wrapper)
    await until(() => wrapper.text().includes('First'))
    const page = wrapper.find('[data-docx-page]')
    expect(page.attributes('style')).toContain('width: 297.638pt')
    expect(wrapper.find('[data-docx-sheet]').attributes('style')).toContain('scale(0.5)')
    expect(wrapper.attributes('aria-label')).toBe('Report')
    await wrapper.setProps({ documentProps: { title: 'Second', points: [] } })
    await until(() => wrapper.text().includes('Second'))
  })

  it('shows the error slot when the tree is wrong', async () => {
    const wrapper = mount(DocxPreview, { props: { document: defineComponent(() => () => h(Section)) } })
    wrappers.push(wrapper)
    await until(() => wrapper.find('[role="alert"]').exists())
    expect(wrapper.text()).toContain('<Document>')
    const custom = mount(DocxPreview, {
      props: { document: defineComponent(() => () => h(Section)) },
      slots: { error: ({ error }: { error: unknown }) => `Oops: ${String(error).length > 0}` },
    })
    wrappers.push(custom)
    await until(() => custom.text().includes('Oops'))
  })

  it('shows render errors, on mount and after changes', async () => {
    const wrapper = mount(DocxPreview, { props: { document: Names, documentProps: { names: [null] }, debounce: 0 } })
    wrappers.push(wrapper)
    await until(() => wrapper.find('[role="alert"]').exists())
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
    await wrapper.setProps({ documentProps: { names: ['fine'] } })
    await until(() => wrapper.find('[data-docx-page]').exists())
    expect(wrapper.text()).toBe('FINE')
    await wrapper.setProps({ documentProps: { names: [null] } })
    await until(() => wrapper.find('[role="alert"]').exists())
    expect(wrapper.find('[data-docx-page]').exists()).toBe(false)
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
  })

  it('drops a measurement that finishes after unmount', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const wrapper = mount(DocxPreview, { props: { document: singleSection(() => h(Image, { src: PNG })) } })
    // The measuring layer asks for the image URL while it renders; unmount before it is measured.
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      queueMicrotask(() => wrapper.unmount())
      return 'blob:measuring'
    })
    await until(() => revoke.mock.calls.some(([url]) => url === 'blob:measuring'))
    expect(wrapper.find('[data-docx-page]').exists()).toBe(false)
  })

  it('paginates with measured heights', async () => {
    // Every block measures 400px (300pt); an A4 body holds two of them.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 400 } as DOMRect)
    const Doc = singleSection(() => [1, 2, 3, 4, 5].map((index) => h(Paragraph, null, () => `Block ${index}`)))
    const wrapper = mount(DocxPreview, { props: { document: Doc } })
    wrappers.push(wrapper)
    await until(() => wrapper.findAll('[data-docx-page]').length === 3)
    expect(wrapper.findAll('[data-docx-page]').map((page) => page.text())).toEqual([
      'Block 1Block 2',
      'Block 3Block 4',
      'Block 5',
    ])
  })

  it('renders on the server without loading docx', async () => {
    const html = await renderToString(
      createSSRApp({ render: () => h(DocxPreview, { document: Report }, { loading: () => 'Loading' }) }),
    )
    expect(html).toContain('data-docx-preview')
    expect(html).toContain('Loading')
  })
})

describe('DocxDownloadButton', () => {
  it('renders and saves the file on click', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const wrapper = mount(DocxDownloadButton, {
      props: { document: Report, documentProps: { title: 'T', points: [] }, fileName: 'report.docx' },
    })
    wrappers.push(wrapper)
    expect(wrapper.text()).toBe('Download DOCX')
    await wrapper.trigger('click')
    await nextTick()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toBe('Preparing…')
    await wrapper.trigger('click')
    await until(() => wrapper.emitted('done') !== undefined)
    expect((wrapper.emitted('done')![0]![0] as Blob).size).toBeGreaterThan(1000)
    expect(click).toHaveBeenCalledOnce()
  })

  it('emits errors and passes state to the slot', async () => {
    const wrapper = mount(DocxDownloadButton, {
      props: { document: defineComponent(() => () => h(Section)) },
      slots: { default: ({ error }: { error: unknown }) => (error ? 'Failed' : 'Get it') },
    })
    wrappers.push(wrapper)
    expect(wrapper.text()).toBe('Get it')
    await wrapper.trigger('click')
    await until(() => wrapper.emitted('error') !== undefined)
    expect(wrapper.text()).toBe('Failed')
  })
})
