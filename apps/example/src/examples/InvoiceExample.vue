<script setup lang="ts">
import { reactive, ref } from 'vue'
import { DocxDownloadButton, DocxPreview } from 'vue-docx-document'

import { useFitScale } from '../ui/fitScale'
import type { InvoiceItem } from './invoice'
import InvoiceDocument from './InvoiceDocument.vue'

let nextId = 3
const invoice = reactive({
  number: '2026-042',
  customer: 'Grace Hopper',
  paid: false,
  items: [
    { id: 1, name: 'Design review', quantity: 2, price: 120 },
    { id: 2, name: 'Implementation', quantity: 10, price: 95 },
  ] as InvoiceItem[],
})
const draft = ref('')
const viewer = ref<HTMLElement | null>(null)
const scale = useFitScale(viewer)

const add = () => {
  if (!draft.value.trim()) return
  invoice.items.push({ id: nextId++, name: draft.value.trim(), quantity: 1, price: 50 })
  draft.value = ''
}
</script>

<template>
  <div class="split">
    <form class="stack" @submit.prevent="add">
      <label class="field">
        <span>Customer</span>
        <input v-model="invoice.customer" type="text" />
      </label>
      <label class="field">
        <span>Number</span>
        <input v-model="invoice.number" type="text" />
      </label>
      <label class="check"><input v-model="invoice.paid" type="checkbox" /> Paid</label>
      <ul class="items" aria-label="Items">
        <li v-for="item in invoice.items" :key="item.id">
          <span>{{ item.name }}</span>
          <input v-model.number="item.quantity" type="number" min="1" :aria-label="`Quantity of ${item.name}`" />
          <button
            type="button"
            class="button button-small"
            @click="invoice.items.splice(invoice.items.indexOf(item), 1)"
          >
            Remove
          </button>
        </li>
      </ul>
      <div class="add">
        <input v-model="draft" type="text" aria-label="New item" placeholder="New item" />
        <button class="button button-small">Add</button>
      </div>
      <DocxDownloadButton
        class="button button-primary"
        :document="InvoiceDocument"
        :document-props="invoice"
        :file-name="`invoice-${invoice.number}.docx`"
      />
    </form>
    <div ref="viewer" class="viewer" role="region" aria-label="Invoice preview" tabindex="0">
      <DocxPreview :document="InvoiceDocument" :document-props="invoice" :scale="scale" label="Invoice document" />
    </div>
  </div>
</template>
