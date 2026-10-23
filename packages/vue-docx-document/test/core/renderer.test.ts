import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import { Document, Paragraph, Section, TextRun } from '../../src'
import { createElementNode, createRoot } from '../../src/core/nodes'
import { nodeOps, renderer } from '../../src/core/renderer'
import { snapshot } from '../../src/core/snapshot'

const mount = (component: Parameters<typeof renderer.createApp>[0]) => {
  const root = createRoot()
  renderer.createApp(component).mount(root)
  return root
}

describe('node operations', () => {
  it('inserts before an anchor and moves nodes between parents', () => {
    const a = createElementNode('PARAGRAPH')
    const b = createElementNode('PARAGRAPH')
    const parent = createElementNode('SECTION')
    const other = createElementNode('SECTION')
    nodeOps.insert(a, parent)
    nodeOps.insert(b, parent, a)
    expect(parent.children).toEqual([b, a])
    expect(nodeOps.nextSibling(b)).toBe(a)
    expect(nodeOps.nextSibling(a)).toBeNull()
    expect(nodeOps.nextSibling(other)).toBeNull()
    nodeOps.insert(b, other)
    expect(parent.children).toEqual([a])
    expect(nodeOps.parentNode(b)).toBe(other)
  })

  it('sets and removes text', () => {
    const paragraph = createElementNode('PARAGRAPH')
    const text = nodeOps.createText('old')
    nodeOps.insert(text, paragraph)
    nodeOps.setText(text, 'changed')
    nodeOps.setText(paragraph, 'ignored')
    expect(paragraph.children).toMatchObject([{ kind: 'text', value: 'changed' }])
    nodeOps.setElementText(paragraph, 'new')
    expect(paragraph.children).toMatchObject([{ kind: 'text', value: 'new' }])
    nodeOps.remove(paragraph.children[0]!)
    nodeOps.remove(text)
    expect(paragraph.children).toEqual([])
    nodeOps.setElementText(paragraph, '')
    expect(paragraph.children).toEqual([])
  })

  it('camelizes props and drops class and style', () => {
    const element = createElementNode('TEXT_RUN')
    nodeOps.patchProp(element, 'font-size', undefined, 12)
    nodeOps.patchProp(element, 'class', undefined, 'x')
    nodeOps.patchProp(element, 'style', undefined, { color: 'red' })
    expect(element.props).toEqual({ fontSize: 12 })
    nodeOps.patchProp(element, 'font-size', 12, undefined)
    expect(element.props).toEqual({})
  })
})

describe('snapshot', () => {
  it('copies the tree, drops comments and casts bare flags', () => {
    const root = mount(
      defineComponent(
        () => () =>
          h(Document, { title: 'T' }, () =>
            h(Section, null, () => [
              h(Paragraph, null, () => [h(TextRun, { bold: '' as never }, () => 'Hi'), ' ']),
              null,
            ]),
          ),
      ),
    )
    expect(snapshot(root)).toEqual({
      type: 'DOCUMENT',
      props: { title: 'T' },
      children: [
        {
          type: 'SECTION',
          props: {},
          children: [
            {
              type: 'PARAGRAPH',
              props: {},
              children: [{ type: 'TEXT_RUN', props: { bold: true }, children: ['Hi'] }, ' '],
            },
          ],
        },
      ],
    })
  })

  it('drops whitespace only where it is never content', () => {
    const root = mount(defineComponent(() => () => h(Document, null, () => [' ', h(Section, null, () => ' ')])))
    expect(snapshot(root)).toMatchObject({ children: [{ type: 'SECTION', children: [' '] }] })
  })

  it('requires a single Document at the root', () => {
    expect(() => snapshot(mount(defineComponent(() => () => h(Section))))).toThrow(
      '[vue-docx-document] The root component must render a single <Document>.',
    )
    expect(() => snapshot(mount(defineComponent(() => () => [h(Document), h(Document)])))).toThrow('single <Document>')
  })

  it('notifies the root on reactive changes', async () => {
    const label = ref('a')
    const root = mount(
      defineComponent(
        () => () => h(Document, null, () => h(Section, null, () => h(Paragraph, null, () => label.value))),
      ),
    )
    const onChange = vi.fn()
    root.onChange = onChange
    label.value = 'b'
    await nextTick()
    expect(onChange).toHaveBeenCalled()
    expect(JSON.stringify(snapshot(root))).toContain('"b"')
  })
})
