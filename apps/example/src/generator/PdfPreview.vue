<script setup lang="ts">
import { PdfViewer } from 'vue-pdf-document'

import { InvoicePdf } from '../invoice/pdfDocument'
import type { InvoiceDocumentProps } from '../invoice/model'

defineProps<{ documentProps: InvoiceDocumentProps }>()
defineEmits<{ rendered: [pageCount: number]; error: [error: unknown] }>()
</script>

<template>
  <PdfViewer
    class="gen-frame"
    title="Invoice preview (PDF)"
    :document="InvoicePdf"
    :document-props="documentProps"
    :debounce="300"
    @rendered="({ pageCount }) => $emit('rendered', pageCount)"
    @error="(error) => $emit('error', error)"
  >
    <template #loading><p class="note">Rendering…</p></template>
  </PdfViewer>
</template>
