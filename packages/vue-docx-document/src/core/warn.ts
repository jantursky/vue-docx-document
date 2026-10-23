const warned = new Set<string>()

/** Warns about input that was recovered from, once per message. */
export const warnOnce = (message: string): void => {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(`[vue-docx-document] ${message}`)
}
