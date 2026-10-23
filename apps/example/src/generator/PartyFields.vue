<script setup lang="ts">
import type { Party } from '../invoice/model'

defineProps<{ legend: string; idPrefix: string }>()
const party = defineModel<Party>({ required: true })
</script>

<template>
  <fieldset class="gen-section">
    <legend>{{ legend }}</legend>
    <div class="gen-grid">
      <label class="field gen-span-2">Name <input :id="`${idPrefix}-name`" v-model="party.name" /></label>
      <label class="field gen-span-2">Street <input v-model="party.street" /></label>
      <label class="field">Postal code <input v-model="party.postalCode" /></label>
      <label class="field">City <input v-model="party.city" /></label>
      <label class="field gen-span-2">Country <input v-model="party.country" /></label>
      <label class="field">Company ID (IČO) <input v-model="party.companyId" /></label>
      <label class="field">Tax ID (DIČ) <input v-model="party.taxId" /></label>
      <label class="field gen-span-2">VAT ID (IČ DPH) <input v-model="party.vatId" /></label>
      <label class="field">Email <input v-model="party.email" type="email" /></label>
      <label class="field">Phone <input v-model="party.phone" type="tel" /></label>
    </div>
  </fieldset>
</template>
