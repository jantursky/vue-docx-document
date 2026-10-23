<script setup lang="ts">
import { computed } from 'vue'

import { formatters, labels } from './i18n'
import { useKit } from './kit/context'
import type { InvoiceDocumentProps, Party } from './model'
import { computeTotals } from './totals'

const props = defineProps<InvoiceDocumentProps>()

// Everything on the page comes from the kit, so this file doesn't know whether it is
// writing a Word file or a PDF.
const { KitDocument, Columns, Column, Line, Spacer, Img, ItemsTable, PageFooter } = useKit()

const t = computed(() => labels[props.invoice.language])
const f = computed(() => formatters(props.invoice.language, props.invoice.currency))
const totals = computed(() => computeTotals(props.invoice))
const showVat = computed(() => props.invoice.vatPayer)
const accent = computed(() => props.invoice.accent || '#1f4e79')

const MUTED = '#4b5563'
const LABEL = '#6b7280'

const addressLines = (party: Party) =>
  [party.street, [party.postalCode, party.city].filter(Boolean).join(' '), party.country].filter(Boolean)

const idLines = (party: Party) =>
  [
    [t.value.companyId, party.companyId],
    [t.value.taxId, party.taxId],
    [t.value.vatId, party.vatId],
  ]
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}: ${value}`)

const contact = (party: Party) => [party.email, party.phone].filter(Boolean).join(' · ')

const parties = computed(() => [
  { label: t.value.supplier, party: props.invoice.seller },
  { label: t.value.customer, party: props.invoice.buyer },
])

// The facts of the invoice, two to a column.
const metaColumns = computed(() => {
  const facts = [
    [t.value.issueDate, f.value.date(props.invoice.issueDate)],
    [t.value.deliveryDate, f.value.date(props.invoice.deliveryDate)],
    [t.value.dueDate, f.value.date(props.invoice.dueDate)],
    [t.value.paymentMethod, t.value.methods[props.invoice.payment.method]],
    [t.value.variableSymbol, props.invoice.payment.variableSymbol],
    [t.value.orderNumber, props.invoice.orderNumber],
  ].filter(([, value]) => value)
  return Array.from({ length: Math.ceil(facts.length / 2) }, (_, index) => facts.slice(index * 2, index * 2 + 2))
})

const payment = computed(() => props.invoice.payment)
const showBank = computed(() => payment.value.method === 'transfer' && (payment.value.iban || payment.value.bankName))

const itemColumns = computed(() => [
  { header: '#', width: 0.4 },
  { header: t.value.item, width: 5 },
  { header: t.value.quantity, width: 1, align: 'right' as const },
  { header: t.value.unit, width: 0.9 },
  { header: t.value.unitPrice, width: 1.7, align: 'right' as const },
  { header: t.value.discount, width: 1, align: 'right' as const },
  ...(showVat.value ? [{ header: t.value.vatRate, width: 1, align: 'right' as const }] : []),
  { header: t.value.amount, width: 1.8, align: 'right' as const },
])

const itemRows = computed(() =>
  props.invoice.items.map((item, index) => [
    String(index + 1),
    item.description,
    f.value.number(item.quantity),
    item.unit,
    f.value.money(item.unitPrice),
    item.discount ? f.value.percent(item.discount) : '',
    ...(showVat.value ? [f.value.percent(item.vatRate)] : []),
    f.value.money(totals.value.lines[index] ?? 0),
  ]),
)

const showRecap = computed(() => showVat.value && !props.invoice.reverseCharge)
const recapColumns = computed(() => [
  { header: t.value.vatRate, width: 0.8 },
  { header: t.value.base, width: 1.4, align: 'right' as const },
  { header: t.value.vat, width: 1.2, align: 'right' as const },
  { header: t.value.total, width: 1.4, align: 'right' as const },
])
const recapRows = computed(() =>
  totals.value.vat.map((line) => [
    f.value.percent(line.rate),
    f.value.money(line.base),
    f.value.money(line.vat),
    f.value.money(line.total),
  ]),
)
const recapFooter = computed(() => [
  t.value.total,
  f.value.money(totals.value.subtotal),
  f.value.money(totals.value.vatTotal),
  f.value.money(totals.value.total),
])

const noteLines = computed(() => (props.invoice.notes ? props.invoice.notes.split('\n') : []))
const footerText = computed(() =>
  [
    props.invoice.seller.name,
    props.invoice.seller.companyId && `${t.value.companyId} ${props.invoice.seller.companyId}`,
    props.invoice.seller.email,
  ]
    .filter(Boolean)
    .join(' · '),
)
</script>

<template>
  <KitDocument
    :title="`${t.invoice} ${invoice.number}`"
    :author="invoice.seller.name"
    :subject="`${t.invoice} ${invoice.number} – ${invoice.buyer.name}`"
    :language="invoice.language"
  >
    <Columns :gap="16">
      <Column :width="1">
        <Img v-if="invoice.logo" :src="invoice.logo" :alt="invoice.seller.name" :height="48" />
        <Line v-else bold :size="16" :color="accent">{{ invoice.seller.name }}</Line>
      </Column>
      <Column :width="1">
        <Line bold :size="24" :color="accent" align="right">{{ t.invoice.toUpperCase() }}</Line>
        <Line :size="11" :color="MUTED" align="right">{{ t.number }} {{ invoice.number }}</Line>
      </Column>
    </Columns>
    <Spacer :height="24" />

    <Columns :gap="16">
      <Column v-for="{ label, party } in parties" :key="label" :width="1" background="#f9fafb" :padding="12">
        <Line caps :size="7.5" :color="LABEL" :after="4">{{ label }}</Line>
        <Line bold :size="11" :after="3">{{ party.name }}</Line>
        <Line v-for="line in addressLines(party)" :key="line" :color="MUTED">{{ line }}</Line>
        <Spacer :height="6" />
        <Line v-for="line in idLines(party)" :key="line">{{ line }}</Line>
        <Line v-if="contact(party)" :color="MUTED">{{ contact(party) }}</Line>
      </Column>
    </Columns>
    <Spacer :height="18" />

    <Columns :gap="16">
      <Column v-for="(facts, index) in metaColumns" :key="index" :width="1">
        <template v-for="[name, value] in facts" :key="name">
          <Line caps :size="7.5" :color="LABEL" :after="1">{{ name }}</Line>
          <Line bold :after="8">{{ value }}</Line>
        </template>
      </Column>
    </Columns>

    <Spacer :height="6" />
    <Columns v-if="showBank" :gap="16">
      <Column v-if="payment.bankName" :width="1">
        <Line caps :size="7.5" :color="LABEL" :after="1">{{ t.bank }}</Line>
        <Line bold>{{ payment.bankName }}</Line>
      </Column>
      <Column v-if="payment.iban" :width="1">
        <Line caps :size="7.5" :color="LABEL" :after="1">{{ t.iban }}</Line>
        <Line bold>{{ payment.iban }}</Line>
      </Column>
      <Column v-if="payment.bic" :width="1">
        <Line caps :size="7.5" :color="LABEL" :after="1">{{ t.bic }}</Line>
        <Line bold>{{ payment.bic }}</Line>
      </Column>
      <Column v-if="qr" :width="1">
        <Img :src="qr" :alt="t.scanToPay" :width="64" :height="64" align="right" />
        <Line :size="6.5" :color="LABEL" align="right">{{ t.scanToPay }}</Line>
      </Column>
    </Columns>
    <Spacer :height="14" />

    <ItemsTable :columns="itemColumns" :rows="itemRows" :accent="accent" />
    <Spacer :height="16" />

    <template v-if="showRecap">
      <Line caps :size="7.5" :color="LABEL" align="right" :after="4">{{ t.vatRecap }}</Line>
      <ItemsTable
        :columns="recapColumns"
        :rows="recapRows"
        :footer="recapFooter"
        :accent="accent"
        :width="260"
        align="right"
      />
      <Spacer :height="10" />
    </template>

    <Columns>
      <Column :width="255" />
      <Column :width="260" :background="accent" :padding="10">
        <Line :size="10" color="#ffffff">{{ t.amountDue }}</Line>
        <Line bold :size="14" color="#ffffff">{{ f.money(totals.total) }}</Line>
      </Column>
    </Columns>
    <Spacer :height="24" />

    <Line v-for="(line, index) in noteLines" :key="index" :after="2">{{ line }}</Line>
    <Line v-if="!invoice.vatPayer" :color="MUTED">{{ t.notVatPayer }}</Line>
    <Line v-else-if="invoice.reverseCharge" :color="MUTED">{{ t.reverseCharge }}</Line>
    <template v-if="invoice.issuedBy">
      <Spacer :height="24" />
      <Line :color="MUTED">{{ t.issuedBy }}: {{ invoice.issuedBy }}</Line>
    </template>

    <PageFooter :text="footerText" :page-template="t.page" />
  </KitDocument>
</template>
