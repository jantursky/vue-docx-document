<script setup lang="ts">
import { Document, Paragraph, Section } from 'vue-docx-document'

defineProps<{ name: string }>()
</script>

<template>
  <Document title="Hello" font="Arial">
    <Section>
      <Paragraph :heading="1" color="#1c1d1f">Hello, {{ name || 'world' }}!</Paragraph>
      <Paragraph :line-height="1.4">
        This page is a Vue component. A custom renderer turns it into a Word file, and the preview you see is drawn from
        the same tree.
      </Paragraph>
    </Section>
  </Document>
</template>
