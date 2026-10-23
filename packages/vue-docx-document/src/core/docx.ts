import type { Document as DocxDocument } from 'docx'
import { h, toValue, type Component, type ComponentPublicInstance, type MaybeRefOrGetter } from 'vue'

import { DOCX_MIME } from './mime'
import type { DocxModel } from './model'
import { createRoot } from './nodes'
import { renderer } from './renderer'
import { resolve } from './resolve'
import { snapshot } from './snapshot'
import { toDocx, writeModel, type WriteOptions } from './write'

type Props = Record<string, unknown>

export { DOCX_MIME }

export interface DocxInstance {
  /** The resolved document, as the preview draws it. */
  toModel(): Promise<DocxModel>
  toBlob(options?: WriteOptions): Promise<Blob>
  toBuffer(options?: WriteOptions): Promise<Uint8Array>
  toBase64(options?: WriteOptions): Promise<string>
  /** The `docx` Document, for anything the components don't cover. */
  toDocx(): Promise<DocxDocument>
  /** Calls `listener` after every change to the tree. Returns a function that unsubscribes. */
  onChange(listener: () => void): () => void
  unmount(): void
}

/**
 * Mounts `document` in a Vue app of its own, with the renderer that builds the document tree.
 * Reactive `props` re-render it; call `unmount()` when you're done.
 */
export const createDocx = (document: Component, props?: MaybeRefOrGetter<Props | undefined>): DocxInstance => {
  const root = createRoot()
  const listeners = new Set<() => void>()
  root.onChange = () => {
    for (const listener of [...listeners]) listener()
  }
  const app = renderer.createApp({ render: () => h(document, toValue(props)) })
  // Without a handler a failing component leaves a comment in its place in production, and the
  // error escapes into the host app otherwise. Each error is kept until its component renders
  // again or goes away, and the document can't be read while any is left.
  const failures = new Map<ComponentPublicInstance | null, unknown>()
  app.config.errorHandler = (error, instance) => {
    failures.set(instance, error)
  }
  app.mixin({
    beforeUpdate(this: ComponentPublicInstance) {
      failures.delete(this)
    },
    unmounted(this: ComponentPublicInstance) {
      failures.delete(this)
    },
  })
  app.mount(root)
  let mounted = true

  const toModel = (): Promise<DocxModel> => {
    if (!mounted) return Promise.reject(new Error('[vue-docx-document] This document was unmounted.'))
    try {
      const [failure] = failures.values()
      if (failures.size > 0) throw failure
      return resolve(snapshot(root))
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }

  const onRender = (blob: Blob): void => {
    const first = root.children.find((child) => child.kind === 'element')
    const handler = first?.kind === 'element' ? first.props.onRender : undefined
    if (typeof handler === 'function') (handler as (info: { blob: Blob }) => void)({ blob })
  }

  return {
    toModel,
    async toBlob(options) {
      const blob = await writeModel(await toModel(), 'blob', options)
      onRender(blob)
      return blob
    },
    async toBuffer(options) {
      return writeModel(await toModel(), 'uint8array', options)
    },
    async toBase64(options) {
      return writeModel(await toModel(), 'base64', options)
    },
    async toDocx() {
      return toDocx(await toModel())
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    unmount() {
      if (!mounted) return
      mounted = false
      listeners.clear()
      root.onChange = null
      app.unmount()
    },
  }
}

const once = async <T>(
  document: Component,
  props: Props | undefined,
  run: (instance: DocxInstance) => Promise<T>,
): Promise<T> => {
  const instance = createDocx(document, props)
  try {
    return await run(instance)
  } finally {
    instance.unmount()
  }
}

/** Renders once to the bytes of a .docx file. Works in Node, workers and the browser. */
export const renderToBuffer = (document: Component, props?: Props, options?: WriteOptions): Promise<Uint8Array> =>
  once(document, props, (instance) => instance.toBuffer(options))

/** Renders once to a Blob with the Word MIME type. */
export const renderToBlob = (document: Component, props?: Props, options?: WriteOptions): Promise<Blob> =>
  once(document, props, (instance) => instance.toBlob(options))

/** Renders once to a base64 string. */
export const renderToBase64 = (document: Component, props?: Props, options?: WriteOptions): Promise<string> =>
  once(document, props, (instance) => instance.toBase64(options))

/** Renders once to the resolved model, without loading `docx`. */
export const renderToModel = (document: Component, props?: Props): Promise<DocxModel> =>
  once(document, props, (instance) => instance.toModel())

/** Saves a Blob in the browser through a temporary link. */
export const saveBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const link = globalThis.document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'
  globalThis.document.body.append(link)
  link.click()
  link.remove()
  // Safari reads the URL after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Renders once and saves the file in the browser. */
export const downloadDocx = async (
  document: Component,
  props?: Props,
  fileName = 'document.docx',
  options?: WriteOptions,
): Promise<Blob> => {
  const blob = await renderToBlob(document, props, options)
  saveBlob(blob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`)
  return blob
}
