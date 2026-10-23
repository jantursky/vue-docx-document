<script setup lang="ts">
import { computed } from 'vue'
import {
  Document,
  Footer,
  Footnote,
  Header,
  List,
  ListItem,
  PageNumber,
  Paragraph,
  Section,
  Tab,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
} from 'vue-docx-document'

import { buildClauses, formatDate, formatMoney } from './clauses'
import type { Contract, ContractParty } from './model'

const props = defineProps<{ contract: Contract }>()

const MUTED = '#5b6370'
const RULE = { style: 'single', size: 0.75, color: '#1f2937' } as const
const HAIRLINE = { style: 'single', size: 0.5, color: '#d1d5db' } as const
const none = { style: 'none' } as const

const title = computed(() => props.contract.title.trim() || 'Services Agreement')
const clauses = computed(() => buildClauses(props.contract))
const parties = computed(() => [
  { number: 1, role: 'Client', party: props.contract.client },
  { number: 2, role: 'Provider', party: props.contract.provider },
])

// What follows the company's name in a party paragraph.
const partyText = (number: number, role: string, party: ContractParty) =>
  `, of ${party.address || '[address]'}${party.registrationNo ? ` (registration no. ${party.registrationNo})` : ''} (the “${role}”)${number === 1 ? '; and' : '.'}`

const lines = (text: string) => text.split('\n').filter((line) => line.trim())

const feeRows = computed(() => {
  const { feeType, amount, estimateHours, currency, paymentDays } = props.contract
  return [
    ['Fee basis', feeType === 'fixed' ? 'Fixed fee' : 'Hourly rate'],
    [feeType === 'fixed' ? 'Fee' : 'Rate per hour', formatMoney(amount, currency)],
    ...(feeType === 'hourly'
      ? [
          ['Estimated hours', String(estimateHours)],
          ['Estimated total', formatMoney(amount * estimateHours, currency)],
        ]
      : []),
    ['Payment terms', `${paymentDays} days from the invoice date`],
  ]
})

// Two lines to sign on, with a caption under each, and the printed name and title between them.
const signatureRows = [
  { kind: 'line', caption: 'Signature', height: 44 },
  { kind: 'text', label: 'Name', field: 'signatory' },
  { kind: 'text', label: 'Title', field: 'title' },
  { kind: 'line', caption: 'Date', height: 30 },
] as const
</script>

<template>
  <Document
    :title="title"
    :creator="contract.provider.company"
    font="Georgia"
    :font-size="10.5"
    :line-height="1.35"
    :space-after="6"
    :headings="{
      title: { bold: true, size: 26, color: '#111827', spaceAfter: 4 },
      1: { bold: true, size: 14, color: '#111827', spaceBefore: 18, spaceAfter: 8, keepNext: true },
      2: { bold: true, size: 11, color: '#111827', spaceBefore: 10, spaceAfter: 4, keepNext: true },
    }"
  >
    <Section :margin="{ top: 72, bottom: 72, left: 72, right: 72, header: 32, footer: 32 }">
      <Header>
        <Paragraph align="right" :size="8" :color="MUTED">{{ title }}</Paragraph>
      </Header>
      <Footer>
        <Paragraph align="center" :size="8" :color="MUTED">
          Page <PageNumber /> of <PageNumber type="total" />
        </Paragraph>
      </Footer>

      <Paragraph heading="title">{{ title }}</Paragraph>
      <Paragraph :color="MUTED" :space-after="16">Effective {{ formatDate(contract.effectiveDate) }}</Paragraph>

      <Paragraph keep-next>This agreement is made between:</Paragraph>
      <Paragraph v-for="{ number, role, party } in parties" :key="role" :indent="24" :hanging="24" align="justify">
        ({{ number }})<Tab /><TextRun bold>{{ party.company || '[Company]' }}</TextRun
        >{{ partyText(number, role, party) }}
      </Paragraph>

      <TableOfContents v-if="contract.tableOfContents" title="Contents" :levels="[1, 2]" />

      <Paragraph :heading="1">Terms</Paragraph>
      <List legal>
        <ListItem v-for="clause in clauses" :key="clause.title" :heading="2" :space-after="8">
          {{ clause.title }}
          <List ordered>
            <ListItem v-for="point in clause.points" :key="point.text" align="justify" :space-after="4">
              {{ point.text }}<Footnote v-if="point.footnote">{{ point.footnote }}</Footnote>
            </ListItem>
          </List>
        </ListItem>
      </List>

      <Paragraph :heading="1" page-break-before>Schedule A – Services and Fees</Paragraph>
      <Paragraph keep-next bold>Services</Paragraph>
      <Table
        :column-widths="[30, 150, 271]"
        :cell-padding="6"
        :borders="{ top: HAIRLINE, bottom: HAIRLINE, insideH: HAIRLINE, left: none, right: none, insideV: none }"
      >
        <TableRow header cant-split background="#f3f4f6" bold>
          <TableCell>No.</TableCell>
          <TableCell>Deliverable</TableCell>
          <TableCell>Includes</TableCell>
        </TableRow>
        <TableRow v-for="(item, index) in contract.deliverables" :key="item.id" cant-split>
          <TableCell>{{ index + 1 }}</TableCell>
          <TableCell bold>{{ item.title }}</TableCell>
          <TableCell>
            <List v-if="lines(item.details).length">
              <ListItem v-for="line in lines(item.details)" :key="line" :space-after="2">{{ line }}</ListItem>
            </List>
            <Paragraph v-else :color="MUTED">No further detail.</Paragraph>
          </TableCell>
        </TableRow>
      </Table>

      <Paragraph keep-next bold :space-before="16">Fees</Paragraph>
      <Table
        :column-widths="[170, 281]"
        :cell-padding="6"
        :borders="{ top: HAIRLINE, bottom: HAIRLINE, insideH: HAIRLINE, left: none, right: none, insideV: none }"
      >
        <TableRow v-for="[label, value] in feeRows" :key="label" cant-split>
          <TableCell :color="MUTED">{{ label }}</TableCell>
          <TableCell>{{ value }}</TableCell>
        </TableRow>
      </Table>

      <Paragraph :heading="1">Signatures</Paragraph>
      <Paragraph keep-next :space-after="12">Signed by the parties' authorised representatives.</Paragraph>
      <Table :column-widths="[215, 21, 215]" :cell-padding="{ top: 2, bottom: 2, left: 0, right: 0 }" borders="none">
        <TableRow cant-split bold>
          <TableCell>For the Client: {{ contract.client.company }}</TableCell>
          <TableCell><Paragraph /></TableCell>
          <TableCell>For the Provider: {{ contract.provider.company }}</TableCell>
        </TableRow>
        <template v-for="row in signatureRows" :key="row.kind === 'line' ? row.caption : row.label">
          <template v-if="row.kind === 'line'">
            <TableRow cant-split :height="row.height">
              <TableCell :borders="{ bottom: RULE }"><Paragraph /></TableCell>
              <TableCell><Paragraph /></TableCell>
              <TableCell :borders="{ bottom: RULE }"><Paragraph /></TableCell>
            </TableRow>
            <TableRow cant-split :size="8" :color="MUTED">
              <TableCell>{{ row.caption }}</TableCell>
              <TableCell><Paragraph /></TableCell>
              <TableCell>{{ row.caption }}</TableCell>
            </TableRow>
          </template>
          <TableRow v-else cant-split>
            <TableCell>{{ row.label }}: {{ contract.client[row.field] }}</TableCell>
            <TableCell><Paragraph /></TableCell>
            <TableCell>{{ row.label }}: {{ contract.provider[row.field] }}</TableCell>
          </TableRow>
        </template>
      </Table>
    </Section>
  </Document>
</template>
