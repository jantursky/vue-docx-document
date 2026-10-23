<script setup lang="ts">
import { ref } from 'vue'
import { DocxDownloadButton, DocxPreview } from 'vue-docx-document'

import { useFitScale } from '../ui/fitScale'
import ReportDocument from './ReportDocument.vue'

const title = ref('Quarterly review')
const sections = ref(3)
const viewer = ref<HTMLElement | null>(null)
const scale = useFitScale(viewer)
</script>

<template>
  <div class="split">
    <div class="stack">
      <label class="field">
        <span>Title</span>
        <input v-model="title" type="text" />
      </label>
      <label class="field">
        <span>Extra sections: {{ sections }}</span>
        <input v-model.number="sections" type="range" min="0" max="30" />
      </label>
      <DocxDownloadButton
        class="button button-primary"
        :document="ReportDocument"
        :document-props="{ title, sections }"
        file-name="report.docx"
      />
      <p class="note">The preview paginates in the browser, so page breaks can differ slightly from Word's.</p>
    </div>
    <div ref="viewer" class="viewer" role="region" aria-label="Report preview" tabindex="0">
      <DocxPreview
        :document="ReportDocument"
        :document-props="{ title, sections }"
        :scale="scale"
        :debounce="250"
        label="Report document"
      />
    </div>
  </div>
</template>
