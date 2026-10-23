<p align="center"><img src="https://raw.githubusercontent.com/jantursky/vue-docx-document/main/apps/docs/public/icon.svg" alt="" width="64" height="64" /></p>

# vue-docx-document

[![npm](https://img.shields.io/npm/v/vue-docx-document)](https://www.npmjs.com/package/vue-docx-document) [![CI](https://github.com/jantursky/vue-docx-document/actions/workflows/ci.yml/badge.svg)](https://github.com/jantursky/vue-docx-document/actions/workflows/ci.yml) [![types](https://img.shields.io/npm/types/vue-docx-document)](https://www.npmjs.com/package/vue-docx-document) [![license](https://img.shields.io/npm/l/vue-docx-document)](https://github.com/jantursky/vue-docx-document/blob/main/LICENSE) [![codecov](https://codecov.io/gh/jantursky/vue-docx-document/graph/badge.svg)](https://codecov.io/gh/jantursky/vue-docx-document)

[Docs](https://vue-docx-document-docs.vercel.app) · [Demo](https://vue-docx-document.vercel.app) · [Changelog](https://github.com/jantursky/vue-docx-document/blob/main/packages/vue-docx-document/CHANGELOG.md) · [GitHub](https://github.com/jantursky/vue-docx-document)

Create Word files with Vue 3 components. Write `<Document>`, `<Section>`, `<Paragraph>`, `<TextRun>` and `<Table>` in a template, with props, `v-for`, `v-if` and computed values, and get a real `.docx` that opens in Word, LibreOffice, Pages and Google Docs. It works in the browser and in Node, and comes with a live HTML preview.

Under the hood it's a custom Vue renderer (`createRenderer`) on top of [docx](https://github.com/dolanmiu/docx). Instead of building `new Paragraph({ children: [new TextRun(…)] })` by hand, you write a template, and reactive data re-renders the document.

## Install

```sh
bun add vue-docx-document
# or: npm install vue-docx-document, pnpm add vue-docx-document, yarn add vue-docx-document
```

It requires Vue `^3.5` and is ESM only. `docx` loads on the first export, not with the page, and adds about 155 kB gzipped. The preview doesn't need it at all.

## Quick start

```vue
<!-- InvoiceDocument.vue -->
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
```

```vue
<!-- App.vue -->
<script setup lang="ts">
import { reactive } from 'vue'
import { DocxDownloadButton, DocxPreview } from 'vue-docx-document'

import InvoiceDocument from './InvoiceDocument.vue'

const invoice = reactive({ customer: 'Ada', items: [{ name: 'Design review', price: 240 }] })
</script>

<template>
  <input v-model="invoice.customer" />
  <DocxPreview :document="InvoiceDocument" :document-props="invoice" :scale="0.75" />
  <DocxDownloadButton :document="InvoiceDocument" :document-props="invoice" file-name="invoice.docx" />
</template>
```

The preview renders again, debounced, whenever the data the document reads changes. In Node, `await renderToBuffer(InvoiceDocument, props)` returns the bytes of the file.

## API

| export                                                                  | what it does                                                                                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Document`, `Section`, `Header`, `Footer`                               | The document, its sections (page size, margins, orientation, columns) and their headers and footers.              |
| `Paragraph`, `TextRun`, `Link`, `Bookmark`, `Break`, `Tab`              | Text. Run formatting cascades from `Table` down to `TextRun`; the nearest value wins.                             |
| `List`, `ListItem`                                                      | Bulleted and numbered lists, nested up to nine levels.                                                            |
| `Table`, `TableRow`, `TableCell`                                        | Tables with column widths, borders, header rows that repeat on every page, and column and row spans.              |
| `Image`                                                                 | PNG, JPEG, GIF, BMP and SVG (with a raster fallback), from a URL, a data URI or bytes.                            |
| `PageBreak`, `ColumnBreak`, `PageNumber`, `Footnote`, `TableOfContents` | Page layout and fields.                                                                                           |
| `<DocxPreview>`                                                         | Renders the document as paginated HTML pages, without loading `docx`.                                             |
| `<DocxDownloadButton>`                                                  | A button that builds the file on click and saves it.                                                              |
| `useDocx(document, props?, { debounce, auto })`                         | `blob`, `url`, `loading` and `error` refs that follow reactive changes, and `update()`.                           |
| `useDocxModel(document, props?)`                                        | The resolved document model, for a preview of your own.                                                           |
| `renderToBlob`, `renderToBuffer`, `renderToBase64`, `renderToModel`     | Render once. `renderToBuffer` works in Node, workers and the browser; `renderToModel` skips `docx`.               |
| `downloadDocx`, `saveBlob`, `DOCX_MIME`                                 | Render and save in the browser, or save a Blob you already have.                                                  |
| `createDocx(document, props?)`                                          | The low-level handle: `toBlob()`, `toBuffer()`, `toBase64()`, `toModel()`, `toDocx()`, `onChange()`, `unmount()`. |
| `toDocx(model)`, `writeModel(model, output)`                            | The `docx` `Document` object for anything the components don't cover, or the file written from a model.           |
| `toPoints(length)`                                                      | Converts a `Length` such as `'2.5cm'` to points.                                                                  |

Lengths are points when you pass a number, or a string with a unit: `'12pt'`, `'16px'`, `'1in'`, `'2.5cm'`, `'20mm'`. Font sizes are points, as in Word.

The [docs](https://vue-docx-document-docs.vercel.app) cover every component and prop, the preview, server rendering, and how one template can produce both a DOCX and a PDF with [vue-pdf-document](https://www.npmjs.com/package/vue-pdf-document).

## License

MIT. The file writer is [docx](https://github.com/dolanmiu/docx) (MIT) by Dolan Miu and contributors.
