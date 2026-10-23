<script setup lang="ts">
import { ref } from 'vue'
import { DocxDownloadButton, DocxPreview } from 'vue-docx-document'

import { useFitScale } from '../ui/fitScale'
import HelloDocument from './HelloDocument.vue'

const name = ref('Ada')
const viewer = ref<HTMLElement | null>(null)
const scale = useFitScale(viewer)
</script>

<template>
  <div class="split">
    <div class="stack">
      <label class="field">
        <span>Name</span>
        <input v-model="name" type="text" />
      </label>
      <DocxDownloadButton
        class="button button-primary"
        :document="HelloDocument"
        :document-props="{ name }"
        file-name="hello.docx"
      />
    </div>
    <div ref="viewer" class="viewer" role="region" aria-label="Hello preview" tabindex="0">
      <DocxPreview :document="HelloDocument" :document-props="{ name }" :scale="scale" label="Hello document" />
    </div>
  </div>
</template>
