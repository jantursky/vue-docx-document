/** `list[index]` for an index the preview produced itself, so it is always there. */
export const at = <T>(list: readonly T[], index: number): T => {
  const item = list[index]
  if (item === undefined) throw new Error(`[vue-docx-document] The preview lost track of item ${index}.`)
  return item
}
