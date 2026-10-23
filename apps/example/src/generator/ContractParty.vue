<script setup lang="ts">
import type { ContractParty } from '../contract/model'

defineProps<{ legend: string; idPrefix: string }>()
const party = defineModel<ContractParty>({ required: true })
</script>

<template>
  <fieldset class="gen-section">
    <legend>{{ legend }}</legend>
    <div class="gen-grid">
      <label class="field gen-span-2">Company <input :id="`${idPrefix}-company`" v-model="party.company" /></label>
      <label class="field gen-span-2">Address <input v-model="party.address" /></label>
      <label class="field gen-span-2">Registration number <input v-model="party.registrationNo" /></label>
      <label class="field">Signatory <input v-model="party.signatory" /></label>
      <label class="field">Signatory's title <input v-model="party.title" /></label>
    </div>
  </fieldset>
</template>
