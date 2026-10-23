<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, ref } from 'vue'

import HelloDocument from './examples/HelloDocument.vue?raw'
import ExamplesSection from './examples/ExamplesSection.vue'
import FormatsSection from './invoice/FormatsSection.vue'
import CodeBlock from './ui/CodeBlock.vue'
import CopyButton from './ui/CopyButton.vue'
import ThemeToggle from './ui/ThemeToggle.vue'

// The generator brings the QR encoder and the invoice kit, so it loads with its tab.
const InvoiceGenerator = defineAsyncComponent(() => import('./generator/InvoiceGenerator.vue'))

const version = __VUE_DOCX_VERSION__
const install = 'npm install vue-docx-document'

type Tab = 'overview' | 'generator'
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'generator', label: 'Invoice generator' },
]

// The tab lives in the URL hash, so #generator links straight to it and Back works.
// Any other hash, such as an example's anchor, belongs to the overview.
const fromHash = (): Tab => (location.hash === '#generator' ? 'generator' : 'overview')
const tab = ref<Tab>(fromHash())
const onHashChange = () => {
  tab.value = fromHash()
}
window.addEventListener('hashchange', onHashChange)
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))

const select = (next: Tab) => {
  tab.value = next
  history.pushState(null, '', `#${next}`)
}

const tabButtons = ref<HTMLButtonElement[]>([])
const onTabKey = (event: KeyboardEvent, index: number) => {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!step) return
  event.preventDefault()
  const next = tabs[(index + step + tabs.length) % tabs.length]
  if (!next) return
  select(next.id)
  tabButtons.value[tabs.indexOf(next)]?.focus()
}

const openGenerator = () => {
  select('generator')
  document.getElementById('tabs')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <a class="skip" href="#main">Skip to content</a>
  <header class="nav">
    <div class="container nav-inner">
      <a class="brand" href="./">
        <svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4M9 12h6M9 16h6" />
        </svg>
        vue-docx-document
        <span class="version">{{ version }}</span>
      </a>
      <nav class="nav-links" aria-label="Project">
        <a href="https://vue-docx-document-docs.vercel.app">Docs</a>
        <a href="https://github.com/jantursky/vue-docx-document">GitHub</a>
        <a href="https://www.npmjs.com/package/vue-docx-document">npm</a>
        <ThemeToggle />
      </nav>
    </div>
  </header>

  <main id="main">
    <section class="band hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">Vue 3 · Word</p>
          <h1 class="display">Word documents from Vue components</h1>
          <p class="lead">
            Write a document with <code>&lt;Document&gt;</code>, <code>&lt;Paragraph&gt;</code>,
            <code>&lt;Table&gt;</code> and <code>&lt;List&gt;</code>. A custom Vue renderer builds the tree,
            <code>&lt;DocxPreview&gt;</code> draws it live, and <code>docx</code> writes the .docx, in the browser or in
            Node.
          </p>
          <div class="actions">
            <a class="button button-primary" href="https://vue-docx-document-docs.vercel.app/getting-started"
              >Get started</a
            >
            <button type="button" class="button" @click="openGenerator">Try the invoice generator</button>
          </div>
          <div class="install">
            <code><span class="install-prompt" aria-hidden="true">$</span> {{ install }}</code>
            <CopyButton :text="install" label="Copy the install command" />
          </div>
        </div>
        <figure class="hero-code">
          <figcaption>HelloDocument.vue</figcaption>
          <CodeBlock :code="HelloDocument" file-name="HelloDocument.vue" />
        </figure>
      </div>
    </section>

    <div id="tabs" class="tabs-bar">
      <div class="container">
        <div class="tabs" role="tablist" aria-label="Demo">
          <button
            v-for="(item, index) in tabs"
            :id="`tab-${item.id}`"
            :key="item.id"
            ref="tabButtons"
            type="button"
            role="tab"
            :aria-selected="tab === item.id"
            :aria-controls="`panel-${item.id}`"
            :tabindex="tab === item.id ? 0 : -1"
            @click="select(item.id)"
            @keydown="onTabKey($event, index)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="tab === 'generator'" id="panel-generator" role="tabpanel" aria-labelledby="tab-generator">
      <section class="band">
        <div class="container container-wide">
          <header class="section-head">
            <p class="eyebrow">Full demo</p>
            <h2>Invoice generator</h2>
            <p>
              One invoice template, written once, rendered as a Word file or a PDF: supplier and customer details, VAT
              per rate, discounts, an EPC payment QR code, your logo, English or Slovak, and a live preview. The draft
              is saved in this browser; export it as JSON to keep it.
            </p>
          </header>
          <InvoiceGenerator />
        </div>
      </section>
    </div>

    <div v-else id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
      <section class="band">
        <div class="container">
          <ExamplesSection />
        </div>
      </section>

      <section class="band band-paper">
        <div class="container">
          <FormatsSection @open="openGenerator" />
        </div>
      </section>

      <section class="band" aria-labelledby="engine-title">
        <div class="container split-60">
          <header class="section-head">
            <p class="eyebrow">Under the hood</p>
            <h2 id="engine-title">A Vue renderer for docx</h2>
            <p>
              <code>createRenderer</code> from Vue builds a plain tree from your components, so templates, slots,
              <code>v-for</code> and reactivity work as usual. The tree is resolved into a model with points, colors and
              numbering settled. The preview draws that model as HTML, and the writer hands it to <code>docx</code>,
              which only loads when you save a file.
            </p>
          </header>
          <ul class="stats">
            <li class="card stat">
              <span class="eyebrow">Preview</span>
              <strong>No file needed</strong>
              <span>HTML pages from the same model, as you type</span>
            </li>
            <li class="card stat">
              <span class="eyebrow">Word features</span>
              <strong>Real ones</strong>
              <span>headings, lists, tables, footnotes, a table of contents and page numbers</span>
            </li>
            <li class="card stat">
              <span class="eyebrow">One entry</span>
              <strong>Browser + Node</strong>
              <span>the same imports in apps, workers and servers</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </main>

  <footer class="footer">
    <div class="container footer-grid">
      <div>
        <h2>vue-docx-document</h2>
        <p>MIT licensed. Files written by docx.</p>
      </div>
      <nav aria-label="Project links">
        <h2>Project</h2>
        <a href="https://vue-docx-document-docs.vercel.app">Docs</a>
        <a href="https://github.com/jantursky/vue-docx-document">GitHub</a>
        <a href="https://www.npmjs.com/package/vue-docx-document">npm</a>
      </nav>
      <nav aria-label="Built on">
        <h2>Built on</h2>
        <a href="https://github.com/dolanmiu/docx">docx</a>
        <a href="https://vuejs.org">Vue</a>
        <a href="https://www.npmjs.com/package/vue-pdf-document">vue-pdf-document</a>
      </nav>
    </div>
  </footer>
</template>
