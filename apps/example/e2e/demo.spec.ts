import { expect, test } from '@playwright/test'

import { download, readDocx, watchErrors } from './helpers'

let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = watchErrors(page)
  await page.goto('/')
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

test('renders a preview for every example', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Word documents from Vue components')
  for (const id of ['#example-minimal', '#example-invoice', '#example-report']) {
    await expect(page.locator(`${id} [data-docx-page]`).first()).toBeVisible()
  }
  await expect(page.locator('#example-minimal [data-docx-page]').first()).toContainText('Hello, Ada!')
})

test('renders again when the data changes', async ({ page }) => {
  const example = page.locator('#example-minimal')
  await example.getByLabel('Name').fill('Grace')
  await expect(example.locator('[data-docx-page]').first()).toContainText('Hello, Grace!')
})

test('downloads the minimal example as a Word file', async ({ page }) => {
  const example = page.locator('#example-minimal')
  await example.getByLabel('Name').fill('Grace')
  const file = await download(page, 'hello.docx', example.getByRole('button', { name: 'Download DOCX' }))
  const { paragraphs, files } = await readDocx(file)
  expect(files).toContain('word/document.xml')
  expect(paragraphs).toContain('Hello, Grace!')
})

test('downloads the invoice under its number, with every item', async ({ page }) => {
  const example = page.locator('#example-invoice')
  await example.getByLabel('Number').fill('2026-099')
  await example.getByLabel('New item').fill('Hosting')
  await example.getByRole('button', { name: 'Add' }).click()
  await expect(example.locator('.items li')).toHaveCount(3)
  await expect(example.locator('[data-docx-page]').first()).toContainText('Hosting')

  const file = await download(page, 'invoice-2026-099.docx', example.getByRole('button', { name: 'Download DOCX' }))
  const { paragraphs } = await readDocx(file)
  expect(paragraphs).toContain('No. 2026-099 · Bill to Harbor & Finch Ltd.')
  expect(paragraphs).toEqual(expect.arrayContaining(['Design review', 'Implementation', 'Hosting']))
  expect(paragraphs).toContain('Total €1240.00')
})

test('the report grows as sections are added', async ({ page }) => {
  const example = page.locator('#example-report')
  const pages = example.locator('[data-docx-page]')
  await expect(pages.first()).toBeVisible()
  const few = await pages.count()
  await example.getByRole('slider').fill('30')
  await expect.poll(() => pages.count()).toBeGreaterThan(few)
})

test('the report download carries headings, a table, a footnote and page numbers', async ({ page }) => {
  const example = page.locator('#example-report')
  await example.getByLabel('Title').fill('Annual review')
  const file = await download(page, 'report.docx', example.getByRole('button', { name: 'Download DOCX' }))
  const { paragraphs, xml, files } = await readDocx(file)
  expect(paragraphs).toContain('Annual review')
  expect(xml).toContain('w:tbl')
  expect(xml).toContain('w:footnoteReference')
  expect(files.some((name) => name.startsWith('word/media/'))).toBe(true)
  expect(files.some((name) => /^word\/footer\d*\.xml$/.test(name))).toBe(true)
})

test('shows the source of an example', async ({ page }) => {
  const example = page.locator('#example-invoice')
  await example.getByRole('button', { name: 'View source' }).click()
  await expect(example.getByRole('tab', { name: 'InvoiceDocument.vue' })).toHaveAttribute('aria-selected', 'true')
  await expect(example.getByRole('tabpanel')).toContainText('<Document')
})

test('shows the kit behind the one-template pattern', async ({ page }) => {
  const section = page.locator('#example-formats')
  await section.getByRole('button', { name: 'View source' }).click()
  await expect(section.getByRole('tabpanel')).toContainText('useKit')
  await section.getByRole('tab', { name: 'kit/docx.ts' }).click()
  await expect(section.getByRole('tabpanel')).toContainText('vue-docx-document')
  await section.getByRole('tab', { name: 'kit/pdf.ts' }).click()
  await expect(section.getByRole('tabpanel')).toContainText('vue-pdf-document')
})

test('opens the generator from the overview', async ({ page }) => {
  await page.locator('#example-formats').getByRole('button', { name: 'Open the invoice generator' }).click()
  await expect(page.getByRole('tab', { name: 'Invoice generator' })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/#generator$/)
})

test('remembers the theme', async ({ page }) => {
  const toggle = page.getByRole('button', { name: /Theme/ })
  await expect(toggle).toContainText('Auto')
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: /Theme/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: /Theme/ }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})
