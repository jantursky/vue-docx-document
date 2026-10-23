import { describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

import { useDocx, useDocxModel } from '../../src'
import Report from '../fixtures/Report.vue'
import { Names } from '../fixtures'

const until = (condition: () => boolean) =>
  vi.waitFor(() => {
    if (!condition()) throw new Error('not yet')
  })

describe('useDocx', () => {
  it('renders a blob and an object URL and re-renders after changes', async () => {
    const title = ref('First')
    const scope = effectScope()
    const result = scope.run(() => useDocx(Report, () => ({ title: title.value, points: [] }), { debounce: 0 }))!
    expect(result.loading.value).toBe(true)
    await until(() => result.url.value !== null)
    const first = result.blob.value
    const firstUrl = result.url.value
    expect(first?.size).toBeGreaterThan(1000)
    expect(result.url.value).toMatch(/^blob:/)
    title.value = 'Second'
    await nextTick()
    await until(() => result.blob.value !== first)
    expect(result.url.value).not.toBe(firstUrl)
    expect(result.error.value).toBeNull()
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    scope.stop()
    expect(result.url.value).toBeNull()
    expect(revoke).toHaveBeenCalledTimes(2)
    revoke.mockRestore()
  })

  it('waits for update() when auto is off, and reports errors', async () => {
    const scope = effectScope()
    const result = scope.run(() => useDocx(Report, { title: 'T', points: [] }, { auto: false }))!
    expect(result.loading.value).toBe(false)
    expect(result.blob.value).toBeNull()
    const blob = await result.update()
    expect(blob).toBe(result.blob.value)
    scope.stop()
    expect(await result.update()).toBeNull()
    expect(result.error.value).toBeNull()

    const broken = effectScope()
    const failing = broken.run(() =>
      useDocx(
        defineComponent(() => () => h('div')),
        undefined,
        { auto: false },
      ),
    )!
    expect(await failing.update()).toBeNull()
    expect(String(failing.error.value)).toContain('single <Document>')
    broken.stop()
  })

  it('reports render errors, on mount and after changes', async () => {
    const names = ref<(string | null)[]>([null])
    let result: ReturnType<typeof useDocx> | undefined
    const wrapper = mount(
      defineComponent(() => {
        result = useDocx(Names, () => ({ names: names.value }), { debounce: 0 })
        return () => h('div')
      }),
    )
    await until(() => result!.error.value instanceof TypeError)
    expect(result!.loading.value).toBe(false)
    names.value = ['ok']
    await until(() => result!.blob.value !== null)
    expect(result!.error.value).toBeNull()
    names.value = [null]
    await until(() => result!.error.value !== null)
    wrapper.unmount()
  })

  it('revokes a replaced URL once a download using it had time to finish', async () => {
    const scope = effectScope()
    const result = scope.run(() => useDocx(Report, { title: 'T', points: [] }, { auto: false }))!
    await result.update()
    const first = result.url.value
    const pending: (() => void)[] = []
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) => {
      pending.push(callback)
      return 0
    }) as typeof setTimeout)
    await result.update()
    vi.mocked(setTimeout).mockRestore()
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    for (const callback of pending) callback()
    expect(revoke).toHaveBeenCalledWith(first)
    revoke.mockClear()
    scope.stop()
    expect(revoke).toHaveBeenCalledOnce()
    revoke.mockRestore()
  })

  it('keeps only the latest of overlapping renders', async () => {
    const scope = effectScope()
    const result = scope.run(() => useDocx(Report, { title: 'T', points: [] }, { auto: false }))!
    const [older, newer] = await Promise.all([result.update(), result.update()])
    expect(result.blob.value).toBe(newer)
    expect(older).not.toBe(newer)
    const failing = scope.run(() => useDocx(Names, { names: [null] }, { auto: false }))!
    expect(await Promise.all([failing.update(), failing.update()])).toEqual([null, null])
    expect(failing.error.value).toBeInstanceOf(TypeError)
    scope.stop()
  })

  it('starts on mount inside a component', async () => {
    let result: ReturnType<typeof useDocx> | undefined
    const wrapper = mount(
      defineComponent(() => {
        result = useDocx(Report, { title: 'Mounted', points: [] }, { debounce: 0 })
        return () => h('div')
      }),
    )
    await until(() => result!.blob.value !== null)
    wrapper.unmount()
  })
})

describe('useDocxModel', () => {
  it('resolves the model and follows props', async () => {
    const points = ref(['One'])
    const scope = effectScope()
    const result = scope.run(() => useDocxModel(Report, () => ({ title: 'T', points: points.value }), { debounce: 0 }))!
    await until(() => result.model.value !== null)
    expect(result.model.value!.sections[0]!.children).toHaveLength(2)
    points.value = ['One', 'Two']
    await nextTick()
    await until(() => result.model.value!.sections[0]!.children.length === 3)
    expect(result.loading.value).toBe(false)
    expect((await result.update())?.sections).toHaveLength(1)
    scope.stop()
    expect(await result.update()).toBeNull()
  })

  it('reports render errors, keeping the last good model', async () => {
    const names = ref<(string | null)[]>(['a'])
    let result: ReturnType<typeof useDocxModel> | undefined
    const wrapper = mount(
      defineComponent(() => {
        result = useDocxModel(Names, () => ({ names: names.value }), { debounce: 0 })
        return () => h('div')
      }),
    )
    await until(() => result!.model.value !== null)
    const good = result!.model.value
    names.value = [null]
    await until(() => result!.error.value instanceof TypeError)
    expect(result!.model.value).toBe(good)
    expect(result!.loading.value).toBe(false)
    names.value = ['b']
    await until(() => result!.error.value === null)
    expect(JSON.stringify(result!.model.value)).toContain('"B"')
    wrapper.unmount()

    const failing = mount(
      defineComponent(() => {
        result = useDocxModel(Names, { names: [null] })
        return () => h('div')
      }),
    )
    await until(() => result!.error.value instanceof TypeError)
    expect(result!.model.value).toBeNull()
    failing.unmount()
  })

  it('keeps only the latest of overlapping updates', async () => {
    const scope = effectScope()
    const result = scope.run(() => useDocxModel(Report, { title: 'T', points: [] }))!
    const [older, newer] = await Promise.all([result.update(), result.update()])
    expect(result.model.value).toBe(newer)
    expect(older).not.toBe(newer)
    const broken = effectScope()
    const failing = broken.run(() => useDocxModel(Names, { names: [null] }))!
    expect(await Promise.all([failing.update(), failing.update()])).toEqual([null, null])
    expect(failing.error.value).toBeInstanceOf(TypeError)
    scope.stop()
    broken.stop()
  })

  it('keeps the error of a broken tree', async () => {
    const scope = effectScope()
    const result = scope.run(() => useDocxModel(defineComponent(() => () => h('div'))))!
    await until(() => result.error.value !== null)
    expect(result.model.value).toBeNull()
    scope.stop()
  })
})
