<script setup lang="ts">
import {
  computed,
  nextTick,
  onScopeDispose,
  shallowRef,
  useId,
  watch,
  type Component,
  type FunctionalComponent,
} from 'vue'

import { useDocxModel } from '../composables/useDocxModel'
import type { DocxModel, ImageModel } from '../core/model'
import { buildFlow, type Flow } from '../preview/flow'
import { headingPages, layoutPages, measure, renderMeasure, renderPages } from '../preview/layout'
import type { Page } from '../preview/paginate'
import type { RenderContext } from '../preview/render'

const props = withDefaults(
  defineProps<{
    /** The document component. It's read once, when the preview mounts. */
    document: Component
    documentProps?: Record<string, unknown>
    debounce?: number
    /** Zoom factor. 1 shows pages at their real size in CSS points. */
    scale?: number
    label?: string
  }>(),
  { documentProps: undefined, debounce: 50, scale: 1, label: 'Document preview' },
)

defineSlots<{
  loading?: () => unknown
  error?: (props: { error: unknown }) => unknown
}>()

const { model, loading, error } = useDocxModel(props.document, () => props.documentProps, { debounce: props.debounce })
const id = `docx${useId()}`

const MIME = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml' }

interface Draft {
  model: DocxModel
  flow: Flow
  urls: Map<Uint8Array, string>
}

interface Layout extends Draft {
  pages: Page[]
  headingPages: Map<string, string>
}

// A new model is drawn hidden first (the draft), measured, then paginated into the layout on show.
const draft = shallowRef<Draft | null>(null)
const layout = shallowRef<Layout | null>(null)
const measureRoot = shallowRef<HTMLElement | null>(null)
let version = 0

const revoke = (urls: Map<Uint8Array, string> | undefined): void => {
  for (const url of urls?.values() ?? []) URL.revokeObjectURL(url)
}

const contextOf = (value: Draft, pages?: Map<string, string>): RenderContext => ({
  model: value.model,
  flow: value.flow,
  id,
  width: 0,
  headingPages: pages,
  image: (image: ImageModel) => {
    let url = value.urls.get(image.data)
    if (!url) {
      url = URL.createObjectURL(new Blob([image.data as BlobPart], { type: MIME[image.type] }))
      value.urls.set(image.data, url)
    }
    return url
  },
})

watch(model, async (value) => {
  if (!value) return
  const current = ++version
  revoke(draft.value?.urls)
  const next: Draft = { model: value, flow: buildFlow(value), urls: new Map() }
  draft.value = next
  await nextTick()
  if (current !== version || !measureRoot.value) return
  const pages = layoutPages(next.flow, measure(measureRoot.value))
  const previous = layout.value
  layout.value = { ...next, pages, headingPages: headingPages(next.flow, pages, value) }
  draft.value = null
  if (previous) revoke(previous.urls)
})

onScopeDispose(() => {
  version++
  revoke(draft.value?.urls)
  revoke(layout.value?.urls)
})

const busy = computed(() => loading.value || draft.value !== null)
const message = computed(() => (error.value instanceof Error ? error.value.message : String(error.value)))

// Rendered with h(): pages are built from the model, not from a fixed template.
const Pages: FunctionalComponent = () =>
  layout.value ? renderPages(layout.value.pages, contextOf(layout.value, layout.value.headingPages), props.scale) : null
const Measure: FunctionalComponent = () => (draft.value ? renderMeasure(contextOf(draft.value)) : null)
</script>

<template>
  <section
    data-docx-preview
    :lang="layout?.model.defaults.language"
    :aria-label="label"
    :aria-busy="busy ? 'true' : undefined"
    :data-loading="busy ? '' : undefined"
    :style="{ position: 'relative' }"
  >
    <slot v-if="error" name="error" :error="error">
      <p role="alert" data-docx-preview-error>{{ message }}</p>
    </slot>
    <Pages v-else-if="layout" />
    <slot v-else name="loading" />
    <div
      v-if="draft"
      ref="measureRoot"
      aria-hidden="true"
      data-docx-preview-measure
      :style="{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        overflow: 'hidden',
        visibility: 'hidden',
      }"
    >
      <Measure />
    </div>
  </section>
</template>
