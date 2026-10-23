<script setup lang="ts">
import { Document, Footer, PageNumber, Paragraph, Section, TextRun } from '../../src'

defineProps<{ title: string; points: string[] }>()
</script>

<template>
  <Document :title="title" creator="Ada">
    <Section>
      <Paragraph heading="title">{{ title }}</Paragraph>
      <Paragraph v-for="point in points" :key="point">
        <TextRun bold>{{ point }}</TextRun> <TextRun italic>matters</TextRun>
      </Paragraph>
      <Footer>
        <Paragraph align="center">Page <PageNumber /></Paragraph>
      </Footer>
    </Section>
  </Document>
</template>
