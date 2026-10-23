<script setup lang="ts">
import {
  Document,
  Footer,
  Footnote,
  Header,
  Image,
  Link,
  List,
  ListItem,
  PageNumber,
  Paragraph,
  Section,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
} from 'vue-docx-document'

import { chartImage } from './chart'

defineProps<{ title: string; sections: number }>()

const teams = [
  ['Checkout', 'Mira', 'Done'],
  ['Search', 'Tomas', 'At risk'],
  ['Mobile', 'Eva', 'On track'],
  ['Billing', 'Jon', 'On track'],
]

const filler =
  'Headings, lists and tables keep their meaning in Word: the navigation pane lists the headings, ' +
  'the table header repeats on every page it spans, and the page numbers in the footer are fields that Word fills in.'
// Thin horizontal rules, no vertical lines.
const rule = { color: '#d1d5db' }
const none = { style: 'none' } as const
const rules = { top: rule, bottom: rule, insideH: rule, left: none, right: none, insideV: none }
</script>

<template>
  <Document
    :title="title"
    creator="vue-docx-document"
    font="Arial"
    :font-size="10.5"
    :line-height="1.3"
    :space-after="8"
    :headings="{ title: { size: 28, color: '#1c1d1f' }, 1: { size: 17, color: '#1c1d1f' }, 2: { size: 13 } }"
  >
    <Section :margin="{ top: 72, bottom: 72, left: 72, right: 72, header: 32, footer: 32 }">
      <Header>
        <Paragraph align="right" :size="8" color="#6b7280">{{ title }} · vue-docx-document</Paragraph>
      </Header>
      <Footer>
        <Paragraph align="center" :size="8" color="#6b7280">
          Page <PageNumber /> of <PageNumber type="total" />
        </Paragraph>
      </Footer>

      <Paragraph heading="title">{{ title }}</Paragraph>
      <Paragraph color="#6b7280">
        Prepared with <Link href="https://vue-docx-document-docs.vercel.app">vue-docx-document</Link>
      </Paragraph>

      <TableOfContents title="Contents" :levels="[1, 2]" />

      <Paragraph :heading="1">Summary</Paragraph>
      <Paragraph>
        Revenue grew in every quarter of the year<Footnote>Figures are rounded and exclude one-off items.</Footnote>.
        The chart below shows the trend, and the list names what we shipped to get there.
      </Paragraph>
      <Image
        :src="chartImage"
        alt="Bar chart of revenue by month, rising from left to right"
        :width="340"
        align="center"
      />

      <Paragraph :heading="2">Shipped</Paragraph>
      <List>
        <ListItem>
          Faster checkout
          <List ordered>
            <ListItem>One page instead of three</ListItem>
            <ListItem>Saved payment methods</ListItem>
          </List>
        </ListItem>
        <ListItem>Search that forgives typos</ListItem>
        <ListItem>A mobile app on both stores</ListItem>
      </List>

      <Paragraph :heading="2">Teams</Paragraph>
      <Table :column-widths="[170, 140, 101]" :cell-padding="6" :borders="rules">
        <TableRow header background="#1c1d1f" color="#ffffff" bold>
          <TableCell>Team</TableCell>
          <TableCell>Owner</TableCell>
          <TableCell>Status</TableCell>
        </TableRow>
        <TableRow v-for="[team, owner, status] in teams" :key="team" cant-split>
          <TableCell>{{ team }}</TableCell>
          <TableCell>{{ owner }}</TableCell>
          <TableCell :bold="status === 'At risk'">{{ status }}</TableCell>
        </TableRow>
      </Table>

      <template v-for="index in sections" :key="index">
        <Paragraph :heading="1">Section {{ index }}</Paragraph>
        <Paragraph>{{ filler }}</Paragraph>
        <Paragraph>{{ filler }}</Paragraph>
      </template>
    </Section>
  </Document>
</template>
