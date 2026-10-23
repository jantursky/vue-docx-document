<script setup lang="ts">
import { ref, watch } from 'vue'

// Light, dark, or the system's choice, kept on <html data-theme>.
type Theme = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'vue-docx-document:theme'
const NEXT: Record<Theme, Theme> = { system: 'dark', dark: 'light', light: 'system' }

const read = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

const theme = ref<Theme>(read())
watch(
  theme,
  (value) => {
    if (value === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', value)
    try {
      if (value === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // The choice just isn't remembered.
    }
  },
  { immediate: true },
)
</script>

<template>
  <button type="button" class="theme-toggle" title="Change theme" @click="theme = NEXT[theme]">
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="3.5" />
      <path
        v-if="theme !== 'dark'"
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4"
      />
    </svg>
    <span class="sr-only">Theme: </span>{{ theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light' }}
  </button>
</template>
