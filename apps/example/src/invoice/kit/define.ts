import { defineComponent, type ComponentObjectPropsOptions, type Slots, type VNodeChild } from 'vue'

import type { KitComponent } from './types'

/**
 * Defines a kit component from its runtime props and a render function. The runtime props
 * matter for booleans only: they let a template write `<Line bold>`.
 */
export const kitComponent = <Props extends object>(
  name: string,
  props: ComponentObjectPropsOptions,
  render: (props: Props, slots: Slots) => VNodeChild,
): KitComponent<Props> =>
  defineComponent({
    name,
    props,
    setup:
      (p, { slots }) =>
      () =>
        render(p as Props, slots),
  }) as unknown as KitComponent<Props>
