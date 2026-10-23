<script setup lang="ts">
import { computed, ref } from 'vue'
import { DocxDownloadButton, DocxPreview } from 'vue-docx-document'

import ContractDocument from '../contract/ContractDocument.vue'
import {
  blankContract,
  GOVERNING_LAWS,
  parseContract,
  sampleContract,
  type Contract,
  type GoverningLaw,
} from '../contract/model'
import DecimalInput from '../ui/DecimalInput.vue'
import { useFitScale } from '../ui/fitScale'
import ContractParty from './ContractParty.vue'
import { useDraft } from './useDraft'

const baseName = computed((): string => {
  const slug = contract.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'contract'
})

const {
  draft: contract,
  message,
  replace,
  exportJson,
  importJson,
} = useDraft<Contract>({
  storageKey: 'vue-docx-document:contract',
  parse: parseContract,
  sample: sampleContract,
  baseName: () => baseName.value,
})

const laws = Object.entries(GOVERNING_LAWS) as [GoverningLaw, { name: string }][]
const documentProps = computed(() => ({ contract }))
const viewer = ref<HTMLElement | null>(null)
const scale = useFitScale(viewer)

const addDeliverable = () => {
  const id = Math.max(0, ...contract.deliverables.map((item) => item.id)) + 1
  contract.deliverables.push({ id, title: '', details: '' })
}

const removeDeliverable = (index: number) => {
  contract.deliverables.splice(index, 1)
}

const moveDeliverable = (index: number, by: -1 | 1) => {
  const [item] = contract.deliverables.splice(index, 1)
  if (item) contract.deliverables.splice(index + by, 0, item)
}
</script>

<template>
  <div class="generator">
    <form class="gen-form" @submit.prevent>
      <fieldset class="gen-section">
        <legend>Agreement</legend>
        <div class="gen-grid">
          <label class="field gen-span-2">Title <input id="contract-title" v-model="contract.title" /></label>
          <label class="field">Effective date <input v-model="contract.effectiveDate" type="date" /></label>
          <label class="field">
            Term (months)
            <input v-model.number="contract.termMonths" type="number" min="1" max="600" />
          </label>
          <label class="field gen-span-2">
            Governing law
            <select v-model="contract.governingLaw">
              <option v-for="[id, law] in laws" :key="id" :value="id">{{ law.name }}</option>
            </select>
          </label>
          <label class="check"><input v-model="contract.autoRenew" type="checkbox" /> Renews automatically</label>
          <label class="check"> <input v-model="contract.tableOfContents" type="checkbox" /> Table of contents </label>
        </div>
      </fieldset>

      <ContractParty v-model="contract.client" legend="Client" id-prefix="client" />
      <ContractParty v-model="contract.provider" legend="Provider" id-prefix="provider" />

      <fieldset class="gen-section">
        <legend>Services</legend>
        <div class="gen-deliverables">
          <div v-for="(item, index) in contract.deliverables" :key="item.id" class="gen-deliverable" data-deliverable>
            <label class="field">Deliverable <input v-model="item.title" /></label>
            <label class="field">
              Includes (one per line)
              <textarea v-model="item.details" rows="3" />
            </label>
            <div class="gen-actions">
              <button type="button" :disabled="index === 0" aria-label="Move up" @click="moveDeliverable(index, -1)">
                ↑
              </button>
              <button
                type="button"
                :disabled="index === contract.deliverables.length - 1"
                aria-label="Move down"
                @click="moveDeliverable(index, 1)"
              >
                ↓
              </button>
              <button type="button" aria-label="Remove deliverable" @click="removeDeliverable(index)">×</button>
            </div>
          </div>
        </div>
        <button type="button" class="button button-small" @click="addDeliverable">Add deliverable</button>
      </fieldset>

      <fieldset class="gen-section">
        <legend>Fees</legend>
        <div class="gen-grid">
          <label class="field">
            Fee basis
            <select v-model="contract.feeType">
              <option value="fixed">Fixed fee</option>
              <option value="hourly">Hourly rate</option>
            </select>
          </label>
          <label class="field">
            Currency
            <select v-model="contract.currency">
              <option>EUR</option>
              <option>GBP</option>
              <option>USD</option>
            </select>
          </label>
          <label class="field">
            {{ contract.feeType === 'fixed' ? 'Fee' : 'Rate per hour' }}
            <DecimalInput v-model="contract.amount" />
          </label>
          <label v-if="contract.feeType === 'hourly'" class="field">
            Estimated hours
            <DecimalInput v-model="contract.estimateHours" />
          </label>
          <label class="field">
            Payment terms (days)
            <input v-model.number="contract.paymentDays" type="number" min="0" max="365" />
          </label>
        </div>
      </fieldset>

      <fieldset class="gen-section">
        <legend>Optional clauses</legend>
        <div class="gen-grid">
          <label class="check gen-span-2">
            <input v-model="contract.confidentiality" type="checkbox" /> Confidentiality
          </label>
          <label class="field gen-span-2">
            Intellectual property
            <select v-model="contract.ip">
              <option value="assign">Assigned to the client</option>
              <option value="license">Licensed to the client</option>
            </select>
          </label>
          <label class="check"><input v-model="contract.liability" type="checkbox" /> Limitation of liability</label>
          <label class="field">
            Cap (% of fees)
            <input
              v-model.number="contract.liabilityCapPercent"
              type="number"
              min="0"
              :disabled="!contract.liability"
            />
          </label>
          <label class="check gen-span-2">
            <input v-model="contract.nonSolicitation" type="checkbox" /> Non-solicitation
          </label>
          <label class="check">
            <input v-model="contract.terminationForConvenience" type="checkbox" /> Termination for convenience
          </label>
          <label class="field">
            Notice (days)
            <input
              v-model.number="contract.noticeDays"
              type="number"
              min="0"
              max="365"
              :disabled="!contract.terminationForConvenience"
            />
          </label>
        </div>
        <p class="note">Sample wording for demonstration. It is not legal advice.</p>
      </fieldset>
    </form>

    <section class="gen-preview" aria-label="Contract preview">
      <div class="gen-toolbar">
        <span class="note">Word document</span>
        <DocxDownloadButton
          class="button button-primary"
          :document="ContractDocument"
          :document-props="documentProps"
          :file-name="`${baseName}.docx`"
          @error="(error) => (message = `The DOCX could not be created: ${String(error)}`)"
        >
          Download DOCX
        </DocxDownloadButton>
      </div>
      <div class="gen-toolbar gen-toolbar-secondary">
        <button type="button" class="button button-small" @click="exportJson">Export JSON</button>
        <label class="button button-small">
          Import JSON
          <input class="sr-only" type="file" accept="application/json,.json" data-import-input @change="importJson" />
        </label>
        <button type="button" class="button button-small" @click="replace(sampleContract())">Load sample</button>
        <button type="button" class="button button-small" @click="replace(blankContract())">Clear</button>
      </div>
      <p v-if="message" class="note" role="alert">{{ message }}</p>

      <div ref="viewer" class="viewer viewer-tall" role="region" aria-label="Contract preview" tabindex="0">
        <DocxPreview
          :document="ContractDocument"
          :document-props="documentProps"
          :scale="scale"
          label="Contract document"
        />
      </div>
      <p class="note">The preview paginates in the browser, so page breaks can differ slightly from Word's.</p>
    </section>
  </div>
</template>
