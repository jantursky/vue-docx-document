<!--
  Generated from apps/docs/docs/getting-started.mdx by scripts/samples.js; edit the source, then run
  `bun run sync:samples`. `bun run typecheck` compiles it against the library.
-->
<script setup lang="ts">
import { Document, Paragraph, Section, TextRun } from 'vue-docx-document'

defineProps<{ name: string }>()
</script>

<template>
  <Document title="Hello" font="Calibri" :font-size="11">
    <Section>
      <Paragraph :heading="1">Hello, {{ name }}</Paragraph>
      <Paragraph> Written with <TextRun bold>Vue components</TextRun> and saved as a Word file. </Paragraph>
    </Section>
  </Document>
</template>
