import JSZip from 'jszip'
import { defineComponent, h, type PropType, type VNodeChild } from 'vue'

import { Document, Paragraph, Section } from '../src'

/** A document with one section that renders `children`. */
export const singleSection = (
  children: () => VNodeChild,
  sectionProps: Record<string, unknown> = {},
  documentProps: Record<string, unknown> = {},
) => defineComponent(() => () => h(Document, documentProps, () => h(Section, sectionProps, children)))

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/** The XML parts of a written .docx, by path. */
export const unzip = async (bytes: Uint8Array): Promise<Record<string, string>> => {
  const zip = await JSZip.loadAsync(bytes)
  const out: Record<string, string> = {}
  for (const [name, file] of Object.entries(zip.files)) {
    if (!file.dir && /\.(xml|rels)$/.test(name)) out[name] = await file.async('string')
  }
  return out
}

/** Every file name in a written .docx. */
export const fileNames = async (bytes: Uint8Array): Promise<string[]> =>
  Object.keys((await JSZip.loadAsync(bytes)).files)

/** Every `w:t` text of a part, in order. */
export const texts = (xml: string): string[] =>
  [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(([, text]) => text!)

/** A 2×1 PNG. */
export const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwQZYAwAZ+sH+XZ+7a0AAAAASUVORK5CYII='),
  (char) => char.charCodeAt(0),
)

/** One paragraph per name, upper-cased; a null name makes that paragraph's render throw. */
const Name = defineComponent({
  props: { name: { type: String as PropType<string | null>, default: null } },
  setup: (props) => () => h(Paragraph, null, () => props.name!.toUpperCase()),
})

export const Names = defineComponent({
  props: { names: { type: Array as PropType<(string | null)[]>, required: true } },
  setup: (props) => () => h(Document, null, () => h(Section, null, () => props.names.map((name) => h(Name, { name })))),
})
