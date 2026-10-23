<!--
  Generated from packages/vue-docx-document/README.md by scripts/samples.js; edit the source, then run
  `bun run sync:samples`. `bun run typecheck` compiles it against the library.
-->
<script setup lang="ts">
import { reactive } from 'vue'
import { DocxDownloadButton, DocxPreview } from 'vue-docx-document'

import InvoiceDocument from './InvoiceDocument.vue'

const invoice = reactive({ customer: 'Ada', items: [{ name: 'Design review', price: 240 }] })
</script>

<template>
  <input v-model="invoice.customer" />
  <DocxPreview :document="InvoiceDocument" :document-props="invoice" :scale="0.75" />
  <DocxDownloadButton :document="InvoiceDocument" :document-props="invoice" file-name="invoice.docx" />
</template>
