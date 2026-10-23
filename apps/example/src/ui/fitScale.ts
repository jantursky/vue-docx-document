import { ref, watch, type Ref } from 'vue'

/** An A4 page is 595 pt, which is about 794 CSS pixels wide. */
const A4_WIDTH_PX = 794

/** A scale that fits A4 pages into `element`'s width, so previews shrink on narrow screens. Never above 1. */
export const useFitScale = (element: Ref<HTMLElement | null>, pageWidth = A4_WIDTH_PX): Ref<number> => {
  const scale = ref(1)

  // The element can come and go (a `v-if`), so each new one is observed and the old one released.
  watch(
    element,
    (target, _previous, onCleanup) => {
      if (!target) return
      const observer = new ResizeObserver(([entry]) => {
        if (entry) scale.value = Math.min(1, Math.floor((Math.max(entry.contentRect.width, 1) / pageWidth) * 100) / 100)
      })
      observer.observe(target)
      onCleanup(() => observer.disconnect())
    },
    { immediate: true, flush: 'post' },
  )

  return scale
}
