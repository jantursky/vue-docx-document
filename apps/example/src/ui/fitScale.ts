import { ref, watch, type Ref } from 'vue'

/** An A4 page is 595 pt, which is about 794 CSS pixels wide. */
const A4_WIDTH_PX = 794

/** A scale that fits A4 pages into `element`'s width, so previews shrink on narrow screens. Never above 1. */
export const useFitScale = (element: Ref<HTMLElement | null>, pageWidth = A4_WIDTH_PX): Ref<number> => {
  const scale = ref(1)
  const fit = (width: number) => Math.min(1, Math.floor((Math.max(width, 1) / pageWidth) * 100) / 100)

  // The element can come and go (a `v-if`), so each new one is observed and the old one released.
  watch(
    element,
    (target, _previous, onCleanup) => {
      if (!target) return
      // Fit right away, so the pages never show at full size while the observer's first frame is pending.
      const style = getComputedStyle(target)
      scale.value = fit(target.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))
      // Changing the scale resizes the element, so the update waits for the next frame
      // instead of triggering another observation in the same one.
      const observer = new ResizeObserver(([entry]) => {
        if (!entry) return
        const next = fit(entry.contentRect.width)
        requestAnimationFrame(() => {
          scale.value = next
        })
      })
      observer.observe(target)
      onCleanup(() => observer.disconnect())
    },
    { immediate: true, flush: 'post' },
  )

  return scale
}
