import {
  getCurrentInstance,
  onMounted,
  onScopeDispose,
  ref,
  shallowReadonly,
  shallowRef,
  type Component,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

import { createDocx, type DocxInstance } from '../core/docx'
import type { DocxModel } from '../core/model'

type Props = Record<string, unknown>

export interface UseDocxModelOptions {
  /** Milliseconds to wait after a change before resolving again. Default 50. */
  debounce?: number
}

export interface UseDocxModelReturn {
  model: Readonly<Ref<DocxModel | null>>
  loading: Readonly<Ref<boolean>>
  error: Readonly<Ref<unknown>>
  update: () => Promise<DocxModel | null>
}

/** Resolves `document` to its model and keeps it current. Never loads `docx`. */
export function useDocxModel(
  document: Component,
  props?: MaybeRefOrGetter<Props | undefined>,
  options: UseDocxModelOptions = {},
): UseDocxModelReturn {
  const { debounce = 50 } = options
  const model = shallowRef<DocxModel | null>(null)
  const loading = ref(true)
  const error = shallowRef<unknown>(null)
  let instance: DocxInstance | undefined
  let stop: (() => void) | undefined
  let disposed = false
  let run = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const update = async (): Promise<DocxModel | null> => {
    if (!instance) return null
    clearTimeout(timer)
    const current = ++run
    loading.value = true
    try {
      const result = await instance.toModel()
      if (current !== run) return result
      model.value = result
      error.value = null
      return result
    } catch (caught) {
      if (current === run) error.value = caught
      return null
    } finally {
      if (current === run) loading.value = false
    }
  }

  const start = (): void => {
    if (disposed) return
    instance = createDocx(document, props)
    stop = instance.onChange(() => {
      clearTimeout(timer)
      timer = setTimeout(() => void update(), debounce)
    })
    void update()
  }

  if (getCurrentInstance()) onMounted(start)
  else start()

  onScopeDispose(() => {
    disposed = true
    run++
    clearTimeout(timer)
    stop?.()
    instance?.unmount()
    instance = undefined
  })

  return {
    model: shallowReadonly(model),
    loading: shallowReadonly(loading),
    error: shallowReadonly(error),
    update,
  }
}
