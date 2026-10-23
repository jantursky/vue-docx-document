// The assertions here run at compile time: `bun run typecheck` fails when the public
// types drift. At runtime the file only checks that the exports exist.
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { Ref } from 'vue'

import * as library from '../src'
import {
  createDocx,
  renderToBase64,
  renderToBlob,
  renderToBuffer,
  renderToModel,
  toPoints,
  useDocx,
  useDocxModel,
  writeModel,
  type DocxInstance,
  type DocxModel,
  type ImageBytes,
  type Length,
  type Paragraph,
  type Section,
  type Table,
  type TextRun,
  type UseDocxReturn,
} from '../src'
import Report from './fixtures/Report.vue'

type PropsOf<T extends abstract new (...args: never) => { $props: unknown }> = InstanceType<T>['$props']

describe('public types', () => {
  it('types primitive props', () => {
    expectTypeOf<PropsOf<typeof Paragraph>>().toHaveProperty('heading')
    expectTypeOf<PropsOf<typeof TextRun>>().toHaveProperty('bold')
    expectTypeOf<PropsOf<typeof Table>>().toHaveProperty('columnWidths')
    expectTypeOf<PropsOf<typeof Section>['size']>().toEqualTypeOf<
      'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | { width: Length; height: Length } | undefined
    >()

    // @ts-expect-error headings stop at 6
    expectTypeOf<PropsOf<typeof Paragraph>['heading']>().toEqualTypeOf<7 | undefined>()
    // @ts-expect-error lengths need a known unit
    const length: Length = '3em'
    expect(length).toBe('3em')
  })

  it('types the render functions, the writer and the composables', () => {
    expectTypeOf(renderToBuffer).returns.toEqualTypeOf<Promise<Uint8Array>>()
    expectTypeOf(renderToBlob).returns.toEqualTypeOf<Promise<Blob>>()
    expectTypeOf(renderToBase64).returns.toEqualTypeOf<Promise<string>>()
    expectTypeOf(renderToModel).returns.toEqualTypeOf<Promise<DocxModel>>()
    expectTypeOf(createDocx).returns.toEqualTypeOf<DocxInstance>()
    expectTypeOf(toPoints).returns.toEqualTypeOf<number>()
    expectTypeOf(writeModel<'base64'>).returns.toEqualTypeOf<Promise<string>>()
    expectTypeOf(writeModel<'blob'>).returns.toEqualTypeOf<Promise<Blob>>()
    expectTypeOf(useDocx).returns.toEqualTypeOf<UseDocxReturn>()
    expectTypeOf<UseDocxReturn['url']>().toEqualTypeOf<Readonly<Ref<string | null>>>()
    expectTypeOf(useDocxModel).returns.toHaveProperty('model')
    expectTypeOf<ImageBytes['type']>().toEqualTypeOf<'png' | 'jpg' | 'gif' | 'bmp'>()
    expectTypeOf(renderToBuffer).toBeCallableWith(Report, { title: 'T', points: [] })
  })

  it('exports the documented names', () => {
    expect(Object.keys(library).sort()).toEqual(
      [
        'Bookmark',
        'Break',
        'ColumnBreak',
        'DOCX_MIME',
        'Document',
        'DocxDownloadButton',
        'DocxPreview',
        'Footer',
        'Footnote',
        'Header',
        'Image',
        'Link',
        'List',
        'ListItem',
        'PageBreak',
        'PageNumber',
        'Paragraph',
        'Section',
        'Tab',
        'Table',
        'TableCell',
        'TableOfContents',
        'TableRow',
        'TextRun',
        'createDocx',
        'downloadDocx',
        'renderToBase64',
        'renderToBlob',
        'renderToBuffer',
        'renderToModel',
        'saveBlob',
        'toDocx',
        'toPoints',
        'useDocx',
        'useDocxModel',
        'writeModel',
      ].sort(),
    )
  })
})
