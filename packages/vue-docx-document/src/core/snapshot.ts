import { STRUCTURAL, TYPES, type DocxElement, type DocxNode } from './nodes'

/** A plain copy of the live tree: no parents, no comments, text as strings. */
export interface TreeNode {
  type: string
  props: Record<string, unknown>
  children: (TreeNode | string)[]
}

const convert = (element: DocxElement): TreeNode => ({
  type: element.type,
  props: { ...element.props },
  children: element.children.flatMap((child: DocxNode): (TreeNode | string)[] => {
    if (child.kind === 'comment') return []
    if (child.kind === 'element') return [convert(child)]
    if (child.value.trim() === '' && STRUCTURAL.has(element.type)) return []
    return [child.value]
  }),
})

/** Copies the tree under the mount container. The root component must render one `<Document>`. */
export const snapshot = (root: DocxElement): TreeNode => {
  const elements = root.children.filter((child): child is DocxElement => child.kind === 'element')
  const [first] = elements
  if (elements.length !== 1 || first?.type !== TYPES.document) {
    throw new Error('[vue-docx-document] The root component must render a single <Document>.')
  }
  return convert(first)
}
