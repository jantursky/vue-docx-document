<script setup lang="ts">
import QRCode from 'qrcode'
import { computed, defineAsyncComponent, reactive, ref, watch } from 'vue'
import { DocxDownloadButton, DocxPreview, saveBlob } from 'vue-docx-document'

import { formatters } from '../invoice/i18n'
import { InvoiceDocx } from '../invoice/docxDocument'
import { blankInvoice, parseInvoice, sampleInvoice, type Invoice } from '../invoice/model'
import { computeTotals, epcPayload, lineTotal } from '../invoice/totals'
import { useFitScale } from '../ui/fitScale'
import PartyFields from './PartyFields.vue'

// The PDF engine is about 1 MB, so it loads when someone asks for a PDF.
const PdfPreview = defineAsyncComponent(() => import('./PdfPreview.vue'))

const STORAGE_KEY = 'vue-docx-document:invoice'
const VAT_RATES = [23, 19, 5, 0]
const MAX_LOGO_BYTES = 1_500_000

// The draft survives reloads. Storage can be missing or full, so every access is guarded.
const load = (): Invoice => {
  try {
    const draft = parseInvoice(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
    if (draft) return draft
  } catch {
    // Fall through to the sample.
  }
  return sampleInvoice()
}

const invoice = reactive<Invoice>(load())
watch(
  invoice,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Not saved; the editor keeps working.
    }
  },
  { deep: true },
)

const replace = (next: Invoice) => {
  Object.assign(invoice, next)
}

const totals = computed(() => computeTotals(invoice))
const f = computed(() => formatters('en', invoice.currency))
const dueBeforeIssue = computed(() =>
  Boolean(invoice.dueDate && invoice.issueDate && invoice.dueDate < invoice.issueDate),
)

// The QR code is drawn here, asynchronously, and handed to the template as a data URI,
// because the document can't wait for a promise while it renders.
const qr = ref<string | null>(null)
const qrPayload = computed(() => (invoice.payment.qr ? epcPayload(invoice, totals.value.total) : null))
watch(
  qrPayload,
  async (payload) => {
    if (!payload) {
      qr.value = null
      return
    }
    const url = await QRCode.toDataURL(payload, { margin: 0, width: 256, errorCorrectionLevel: 'M' })
    if (payload === qrPayload.value) qr.value = url
  },
  { immediate: true },
)

const documentProps = computed(() => ({ invoice, qr: qr.value }))
const baseName = computed(() => `invoice-${invoice.number || 'draft'}`)

type Format = 'docx' | 'pdf'
const FORMATS: { id: Format; label: string }[] = [
  { id: 'docx', label: 'DOCX' },
  { id: 'pdf', label: 'PDF' },
]
const format = ref<Format>('docx')
const viewer = ref<HTMLElement | null>(null)
const scale = useFitScale(viewer)
const pdfPages = ref<number | null>(null)
watch(format, () => (pdfPages.value = null))

const message = ref('')
const pdfBusy = ref(false)

const downloadPdf = async () => {
  pdfBusy.value = true
  message.value = ''
  try {
    const { renderInvoicePdf } = await import('../invoice/pdfDocument')
    saveBlob(await renderInvoicePdf(documentProps.value), `${baseName.value}.pdf`)
  } catch (error) {
    message.value = `The PDF could not be created: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    pdfBusy.value = false
  }
}

const addItem = () => {
  const id = Math.max(0, ...invoice.items.map((item) => item.id)) + 1
  invoice.items.push({ id, description: '', quantity: 1, unit: 'pc', unitPrice: 0, discount: 0, vatRate: 23 })
}

const removeItem = (index: number) => {
  invoice.items.splice(index, 1)
}

const moveItem = (index: number, by: -1 | 1) => {
  const [item] = invoice.items.splice(index, 1)
  if (item) invoice.items.splice(index + by, 0, item)
}

const exportJson = () => {
  saveBlob(new Blob([JSON.stringify(invoice, null, 2)], { type: 'application/json' }), `${baseName.value}.json`)
}

const importJson = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const imported = parseInvoice(JSON.parse(await file.text()))
    if (!imported) throw new Error('not an invoice')
    replace(imported)
    message.value = `Loaded ${file.name}.`
  } catch {
    message.value = `${file.name} isn't an invoice exported from this generator.`
  }
}

const loadLogo = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    message.value = 'The logo must be a PNG or JPEG file.'
    return
  }
  if (file.size > MAX_LOGO_BYTES) {
    message.value = 'The logo must be smaller than 1.5 MB.'
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    invoice.logo = typeof reader.result === 'string' ? reader.result : null
    message.value = ''
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="generator">
    <form class="gen-form" @submit.prevent>
      <fieldset class="gen-section">
        <legend>Invoice</legend>
        <div class="gen-grid">
          <label class="field">Number <input id="gen-number" v-model="invoice.number" /></label>
          <label class="field">Order number <input v-model="invoice.orderNumber" /></label>
          <label class="field">Issue date <input v-model="invoice.issueDate" type="date" /></label>
          <label class="field">Date of supply <input v-model="invoice.deliveryDate" type="date" /></label>
          <label class="field">Due date <input v-model="invoice.dueDate" type="date" /></label>
          <label class="field">
            Currency
            <select v-model="invoice.currency">
              <option>EUR</option>
              <option>CZK</option>
              <option>USD</option>
              <option>GBP</option>
            </select>
          </label>
          <label class="field">
            Language of the invoice
            <select v-model="invoice.language">
              <option value="en">English</option>
              <option value="sk">Slovenčina</option>
            </select>
          </label>
          <label class="field">Accent color <input v-model="invoice.accent" type="color" /></label>
          <label class="check"><input v-model="invoice.vatPayer" type="checkbox" /> Supplier is a VAT payer</label>
          <label class="check">
            <input v-model="invoice.reverseCharge" type="checkbox" :disabled="!invoice.vatPayer" /> Reverse charge
          </label>
        </div>
        <p v-if="dueBeforeIssue" class="warning" role="status">The due date is before the issue date.</p>
      </fieldset>

      <PartyFields v-model="invoice.seller" legend="Supplier" id-prefix="seller" />
      <PartyFields v-model="invoice.buyer" legend="Customer" id-prefix="buyer" />

      <fieldset class="gen-section">
        <legend>Payment</legend>
        <div class="gen-grid">
          <label class="field">
            Method
            <select v-model="invoice.payment.method">
              <option value="transfer">Bank transfer</option>
              <option value="card">Card</option>
              <option value="cash">Cash</option>
            </select>
          </label>
          <label class="field">Reference (variable symbol) <input v-model="invoice.payment.variableSymbol" /></label>
          <template v-if="invoice.payment.method === 'transfer'">
            <label class="field gen-span-2">Bank <input v-model="invoice.payment.bankName" /></label>
            <label class="field">IBAN <input v-model="invoice.payment.iban" /></label>
            <label class="field">BIC / SWIFT <input v-model="invoice.payment.bic" /></label>
            <label class="check gen-span-2">
              <input v-model="invoice.payment.qr" type="checkbox" /> Payment QR code (EPC / SEPA, EUR only)
            </label>
          </template>
        </div>
        <p v-if="invoice.payment.qr && invoice.payment.method === 'transfer' && !qrPayload" class="warning">
          The QR code needs EUR, a supplier name, an IBAN and an amount above zero.
        </p>
      </fieldset>

      <fieldset class="gen-section">
        <legend>Items</legend>
        <div class="gen-items" role="table" aria-label="Items">
          <div class="gen-item gen-item-head" role="row">
            <span role="columnheader">Description</span>
            <span role="columnheader">Qty</span>
            <span role="columnheader">Unit</span>
            <span role="columnheader">Price</span>
            <span role="columnheader">Disc. %</span>
            <span role="columnheader">VAT %</span>
            <span role="columnheader">Amount</span>
            <span role="columnheader"><span class="sr-only">Actions</span></span>
          </div>
          <div v-for="(item, index) in invoice.items" :key="item.id" class="gen-item" role="row" data-item>
            <span class="gen-description" role="cell"
              ><input v-model="item.description" aria-label="Description" placeholder="What you delivered"
            /></span>
            <span role="cell"
              ><input v-model.number="item.quantity" aria-label="Quantity" type="number" min="0" step="any"
            /></span>
            <span role="cell"><input v-model="item.unit" aria-label="Unit" /></span>
            <span role="cell"
              ><input v-model.number="item.unitPrice" aria-label="Unit price" type="number" min="0" step="0.01"
            /></span>
            <span role="cell"
              ><input v-model.number="item.discount" aria-label="Discount" type="number" min="0" max="100" step="any"
            /></span>
            <span role="cell">
              <select v-model.number="item.vatRate" aria-label="VAT rate" :disabled="!invoice.vatPayer">
                <option v-for="rate in VAT_RATES" :key="rate" :value="rate">{{ rate }}</option>
              </select>
            </span>
            <span class="gen-amount" role="cell">{{ f.money(lineTotal(item)) }}</span>
            <span class="gen-actions" role="cell">
              <button type="button" :disabled="index === 0" aria-label="Move up" @click="moveItem(index, -1)">↑</button>
              <button
                type="button"
                :disabled="index === invoice.items.length - 1"
                aria-label="Move down"
                @click="moveItem(index, 1)"
              >
                ↓
              </button>
              <button type="button" aria-label="Remove item" @click="removeItem(index)">×</button>
            </span>
          </div>
        </div>
        <button type="button" class="button button-small" @click="addItem">Add item</button>

        <dl class="gen-totals">
          <dt>Subtotal</dt>
          <dd data-total="subtotal">{{ f.money(totals.subtotal) }}</dd>
          <template v-if="invoice.vatPayer">
            <dt>VAT</dt>
            <dd data-total="vat">{{ f.money(totals.vatTotal) }}</dd>
          </template>
          <dt>Amount due</dt>
          <dd data-total="total">{{ f.money(totals.total) }}</dd>
        </dl>
      </fieldset>

      <fieldset class="gen-section">
        <legend>Notes and branding</legend>
        <label class="field">Notes <textarea v-model="invoice.notes" rows="3" /></label>
        <label class="field">Issued by <input v-model="invoice.issuedBy" /></label>
        <div class="gen-logo">
          <label class="button button-small">
            {{ invoice.logo ? 'Replace logo' : 'Upload logo' }}
            <input class="sr-only" type="file" accept="image/png,image/jpeg" data-logo-input @change="loadLogo" />
          </label>
          <button v-if="invoice.logo" type="button" class="button button-small" @click="invoice.logo = null">
            Remove logo
          </button>
          <img v-if="invoice.logo" :src="invoice.logo" alt="Logo preview" class="gen-logo-preview" />
        </div>
      </fieldset>
    </form>

    <section class="gen-preview" aria-label="Invoice preview">
      <div class="gen-toolbar">
        <div class="segmented" role="group" aria-label="Preview format">
          <button
            v-for="option in FORMATS"
            :key="option.id"
            type="button"
            :aria-pressed="format === option.id"
            :data-format="option.id"
            @click="format = option.id"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="gen-downloads">
          <DocxDownloadButton
            class="button button-primary"
            :document="InvoiceDocx"
            :document-props="documentProps"
            :file-name="`${baseName}.docx`"
            @error="(error) => (message = `The DOCX could not be created: ${String(error)}`)"
          >
            Download DOCX
          </DocxDownloadButton>
          <button type="button" class="button" :disabled="pdfBusy" data-download-pdf @click="downloadPdf">
            {{ pdfBusy ? 'Preparing PDF…' : 'Download PDF' }}
          </button>
        </div>
      </div>
      <div class="gen-toolbar gen-toolbar-secondary">
        <button type="button" class="button button-small" @click="exportJson">Export JSON</button>
        <label class="button button-small">
          Import JSON
          <input class="sr-only" type="file" accept="application/json,.json" data-import-input @change="importJson" />
        </label>
        <button type="button" class="button button-small" @click="replace(sampleInvoice())">Load sample</button>
        <button type="button" class="button button-small" @click="replace(blankInvoice())">Clear</button>
      </div>
      <p v-if="message" class="note" role="alert">{{ message }}</p>

      <div
        v-if="format === 'docx'"
        ref="viewer"
        class="viewer viewer-tall"
        role="region"
        aria-label="DOCX preview"
        tabindex="0"
      >
        <DocxPreview :document="InvoiceDocx" :document-props="documentProps" :scale="scale" label="Invoice document" />
      </div>
      <template v-else>
        <PdfPreview
          :document-props="documentProps"
          @rendered="(pages) => (pdfPages = pages)"
          @error="(error) => (message = `Rendering failed: ${String(error)}`)"
        />
        <p class="note" role="status" data-status>
          {{ pdfPages === null ? 'Rendering…' : `Ready · ${pdfPages} ${pdfPages === 1 ? 'page' : 'pages'}` }}
        </p>
      </template>
      <p v-if="format === 'docx'" class="note">
        The preview paginates in the browser, so page breaks can differ slightly from Word's.
      </p>
    </section>
  </div>
</template>
