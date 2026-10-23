<script setup lang="ts">
import { ref, watch } from 'vue'

// A number field that always shows a dot and accepts a comma, whatever the browser's locale:
// `<input type="number">` shows the locale's separator, so the same value reads differently.
const props = withDefaults(defineProps<{ min?: number; max?: number }>(), { min: 0, max: Infinity })
const model = defineModel<number>({ required: true })

const text = ref(String(model.value))

const parse = (value: string): number | null => {
  const number = Number(value.trim().replace(',', '.'))
  return value.trim() !== '' && Number.isFinite(number) && number >= props.min && number <= props.max ? number : null
}

// An outside change shows up in the field; typing "1." must not be rewritten to "1" on the way.
watch(model, (value) => {
  if (parse(text.value) !== value) text.value = String(value)
})

const onInput = (event: Event) => {
  text.value = (event.target as HTMLInputElement).value
  const value = parse(text.value)
  if (value !== null) model.value = value
}
</script>

<template>
  <input
    :value="text"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    @input="onInput"
    @blur="text = String(model)"
  />
</template>
