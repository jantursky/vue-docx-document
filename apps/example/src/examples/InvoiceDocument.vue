<script setup lang="ts">
import { computed } from 'vue'
import { Document, Paragraph, Section, Table, TableCell, TableRow } from 'vue-docx-document'

import type { InvoiceItem } from './invoice'

const props = defineProps<{ number: string; customer: string; items: InvoiceItem[]; paid: boolean }>()

const money = (value: number) => `€${value.toFixed(2)}`
const total = computed(() => props.items.reduce((sum, item) => sum + item.quantity * item.price, 0))
// Thin horizontal rules, no vertical lines.
const rule = { color: '#d1d5db' }
const none = { style: 'none' } as const
const rules = { top: none, bottom: rule, insideH: rule, left: none, right: none, insideV: none }
</script>

<template>
  <Document :title="`Invoice ${number}`" creator="vue-docx-document demo" font="Arial" :font-size="10.5">
    <Section>
      <Paragraph heading="title">Invoice</Paragraph>
      <Paragraph color="#6b7280" :space-after="18">No. {{ number }} · Bill to {{ customer }}</Paragraph>

      <Table :column-widths="[221, 50, 90, 90]" :cell-padding="6" :borders="rules">
        <TableRow header bold>
          <TableCell>Item</TableCell>
          <TableCell align="right">Qty</TableCell>
          <TableCell align="right">Price</TableCell>
          <TableCell align="right">Amount</TableCell>
        </TableRow>
        <TableRow v-for="item in items" :key="item.id" cant-split>
          <TableCell>{{ item.name }}</TableCell>
          <TableCell align="right">{{ item.quantity }}</TableCell>
          <TableCell align="right">{{ money(item.price) }}</TableCell>
          <TableCell align="right">{{ money(item.quantity * item.price) }}</TableCell>
        </TableRow>
      </Table>

      <Paragraph align="right" bold :size="14" :space-before="14">Total {{ money(total) }}</Paragraph>
      <Paragraph v-if="paid" align="right" bold :size="16" color="#047857">PAID</Paragraph>
    </Section>
  </Document>
</template>
