import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import {
  createDocx,
  Document,
  downloadDocx,
  Paragraph,
  renderToBuffer,
  renderToModel,
  saveBlob,
  Section,
} from '../../src'
import { Names, singleSection } from '../fixtures'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('createDocx', () => {
  it('follows reactive props and tells listeners about changes', async () => {
    const title = ref('One')
    const Titled = defineComponent({
      props: { title: { type: String, required: true } },
      setup: (props) => () => h(Document, null, () => h(Section, null, () => h(Paragraph, null, () => props.title))),
    })
    const instance = createDocx(Titled, () => ({ title: title.value }))
    const listener = vi.fn()
    const stop = instance.onChange(listener)
    expect(JSON.stringify(await instance.toModel())).toContain('One')
    title.value = 'Two'
    await nextTick()
    expect(listener).toHaveBeenCalled()
    expect(JSON.stringify(await instance.toModel())).toContain('Two')
    stop()
    instance.unmount()
    instance.unmount()
    await expect(instance.toModel()).rejects.toThrow('This document was unmounted.')
  })

  it('calls onRender with each Blob', async () => {
    const onRender = vi.fn()
    const instance = createDocx(singleSection(() => 'x', {}, { onRender }))
    const blob = await instance.toBlob()
    expect(onRender).toHaveBeenCalledWith({ blob })
    expect((await instance.toBuffer()).length).toBeGreaterThan(1000)
    expect(typeof (await instance.toBase64())).toBe('string')
    instance.unmount()
  })

  it('rejects instead of throwing when the tree is wrong', async () => {
    const instance = createDocx(defineComponent(() => () => h(Section)))
    await expect(instance.toModel()).rejects.toThrow('single <Document>')
    instance.unmount()
  })
})

describe('render errors', () => {
  const text = async (instance: ReturnType<typeof createDocx>) => JSON.stringify(await instance.toModel())

  it('rejects with the error of a component that failed to render', async () => {
    await expect(renderToModel(Names, { names: ['a', null] })).rejects.toThrow(TypeError)
    await expect(renderToBuffer(Names, { names: [null] })).rejects.toThrow(TypeError)
    const Thrower = defineComponent(() => () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- a component may throw anything
      throw 'not an Error'
    })
    await expect(renderToModel(Thrower)).rejects.toThrow('not an Error')
  })

  it('rejects after a failed update until the component renders again or goes away', async () => {
    const names = ref<(string | null)[]>(['a'])
    const instance = createDocx(Names, () => ({ names: names.value }))
    expect(await text(instance)).toContain('"A"')
    names.value = [null]
    await nextTick()
    await expect(instance.toModel()).rejects.toThrow(TypeError)
    names.value = ['b']
    await nextTick()
    expect(await text(instance)).toContain('"B"')
    names.value = ['c', null]
    await nextTick()
    await expect(instance.toModel()).rejects.toThrow(TypeError)
    names.value = ['c']
    await nextTick()
    expect(await text(instance)).toContain('"C"')
    instance.unmount()
  })
})

describe('saving', () => {
  it('saves through a temporary link and revokes the URL later', () => {
    vi.useFakeTimers()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    saveBlob(new Blob(['x']), 'file.docx')
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download]')).toBeNull()
    vi.advanceTimersByTime(10_000)
    expect(revoke).toHaveBeenCalledOnce()
  })

  it('adds the extension when downloading', async () => {
    let name = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download
    })
    const blob = await downloadDocx(
      singleSection(() => 'x'),
      undefined,
      'report',
    )
    expect(name).toBe('report.docx')
    expect(blob.size).toBeGreaterThan(1000)
    await downloadDocx(singleSection(() => 'x'))
    expect(name).toBe('document.docx')
  })
})
