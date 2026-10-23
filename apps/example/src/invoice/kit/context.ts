import { defineComponent, h, inject, provide, type Component, type InjectionKey } from 'vue'

import type { Kit } from './types'

const kitKey: InjectionKey<Kit> = Symbol('invoice-kit')

/** The kit the template renders with, provided by `withKit`. */
export const useKit = (): Kit => {
  const kit = inject(kitKey)
  if (!kit) throw new Error('useKit() needs a component made with withKit().')
  return kit
}

/** Wraps a template so every kit component inside it comes from `kit`. */
export const withKit = <Props extends object>(kit: Kit, template: Component<Props>): Component<Props> =>
  defineComponent({
    name: 'WithKit',
    inheritAttrs: false,
    setup: (_props, { attrs }) => {
      provide(kitKey, kit)
      return () => h(template as Component, attrs)
    },
  }) as Component<Props>
