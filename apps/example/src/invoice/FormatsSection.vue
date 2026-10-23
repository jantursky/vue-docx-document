<script setup lang="ts">
import ExampleCard from '../examples/ExampleCard.vue'
import docxKit from './kit/docx.ts?raw'
import pdfKit from './kit/pdf.ts?raw'
import kitTypes from './kit/types.ts?raw'
import template from './InvoiceTemplate.vue?raw'

defineEmits<{ open: [] }>()
</script>

<template>
  <section class="formats" aria-labelledby="formats-title">
    <header class="section-head">
      <p class="eyebrow">Pattern</p>
      <h2 id="formats-title">One template, two formats</h2>
      <p>
        The invoice generator writes its template once. The template only uses a small kit of layout components:
        <code>Columns</code>, <code>Line</code>, <code>ItemsTable</code> and a few more. The kit has two implementations
        with identical props, one on vue-docx-document and one on
        <a href="https://www.npmjs.com/package/vue-pdf-document">vue-pdf-document</a>, and the template gets the one it
        renders with through <code>provide</code> and <code>inject</code>.
      </p>
    </header>

    <ExampleCard
      id="example-formats"
      title="InvoiceTemplate.vue"
      :files="[
        { name: 'InvoiceTemplate.vue', code: template },
        { name: 'kit/types.ts', code: kitTypes },
        { name: 'kit/docx.ts', code: docxKit },
        { name: 'kit/pdf.ts', code: pdfKit },
      ]"
    >
      <template #description>
        <p>The same file, the same data, a .docx and a .pdf.</p>
      </template>
      <ol class="flow" aria-label="How the template reaches both formats">
        <li>
          <strong>InvoiceTemplate.vue</strong>
          <span>Columns, Line, ItemsTable</span>
        </li>
        <li>
          <strong>docx kit</strong>
          <span>Table, Paragraph, TextRun</span>
          <em>.docx</em>
        </li>
        <li>
          <strong>pdf kit</strong>
          <span>View, Text, Image</span>
          <em>.pdf</em>
        </li>
      </ol>
      <div class="actions">
        <button type="button" class="button button-primary" @click="$emit('open')">Open the invoice generator</button>
      </div>
    </ExampleCard>
  </section>
</template>
