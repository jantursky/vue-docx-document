import { reactive, ref, watch } from 'vue'
import { saveBlob } from 'vue-docx-document'

/**
 * A document being edited: it survives reloads in localStorage, and moves in and out as JSON.
 * Everything that comes from outside goes through `parse`, which returns a clean document or `null`.
 */
export const useDraft = <T extends object>(options: {
  storageKey: string
  parse: (value: unknown) => T | null
  sample: () => T
  /** The file name without its extension. */
  baseName: () => string
}) => {
  // Storage can be missing or full, so every access is guarded.
  const load = (): T => {
    try {
      const draft = options.parse(JSON.parse(localStorage.getItem(options.storageKey) ?? 'null'))
      if (draft) return draft
    } catch {
      // Fall through to the sample.
    }
    return options.sample()
  }

  const draft = reactive(load()) as T
  watch(
    draft,
    (value) => {
      try {
        localStorage.setItem(options.storageKey, JSON.stringify(value))
      } catch {
        // Not saved; the editor keeps working.
      }
    },
    { deep: true },
  )

  const message = ref('')

  const replace = (next: T) => {
    Object.assign(draft, next)
  }

  const exportJson = () => {
    saveBlob(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }), `${options.baseName()}.json`)
  }

  const importJson = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const imported = options.parse(JSON.parse(await file.text()))
      if (!imported) throw new Error('not valid')
      replace(imported)
      message.value = `Loaded ${file.name}.`
    } catch {
      message.value = `${file.name} isn't a file exported from this generator.`
    }
  }

  return { draft, message, replace, exportJson, importJson }
}
