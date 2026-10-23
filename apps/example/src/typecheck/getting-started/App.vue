<!--
  Generated from apps/docs/docs/getting-started.mdx by scripts/samples.js; edit the source, then run
  `bun run sync:samples`. `bun run typecheck` compiles it against the library.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { DocxDownloadButton, DocxPreview } from 'vue-docx-document'

import HelloDocument from './HelloDocument.vue'

const name = ref('Ada')
</script>

<template>
  <input v-model="name" />
  <DocxDownloadButton :document="HelloDocument" :document-props="{ name }" file-name="hello.docx" />
  <DocxPreview :document="HelloDocument" :document-props="{ name }" />
</template>
