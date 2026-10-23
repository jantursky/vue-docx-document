<!--
  Generated from packages/vue-docx-document/README.md by scripts/samples.js; edit the source, then run
  `bun run sync:samples`. `bun run typecheck` compiles it against the library.
-->
<script setup lang="ts">
import {
  Document,
  Footer,
  PageNumber,
  Paragraph,
  Section,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'vue-docx-document'

defineProps<{ customer: string; items: { name: string; price: number }[] }>()
</script>

<template>
  <Document title="Invoice" font="Inter" :font-size="10.5">
    <Section size="A4" margin="2cm">
      <Paragraph heading="title">Invoice</Paragraph>
      <Paragraph
        >Bill to <TextRun bold>{{ customer }}</TextRun></Paragraph
      >
      <Table :column-widths="['12cm', '5cm']">
        <TableRow header bold background="#f4f5f6">
          <TableCell>Item</TableCell>
          <TableCell align="right">Price</TableCell>
        </TableRow>
        <TableRow v-for="item in items" :key="item.name">
          <TableCell>{{ item.name }}</TableCell>
          <TableCell align="right">€{{ item.price }}</TableCell>
        </TableRow>
      </Table>
      <Footer>
        <Paragraph align="right" :size="9">Page <PageNumber /> of <PageNumber type="total" /></Paragraph>
      </Footer>
    </Section>
  </Document>
</template>
