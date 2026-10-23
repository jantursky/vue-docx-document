import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { download, readDocx, watchErrors } from './helpers'

let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = watchErrors(page)
  await page.goto('/#contract')
  await expect(pages(page).first()).toBeVisible({ timeout: 15_000 })
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

const pages = (page: Page) => page.locator('[data-docx-page]')
const downloadDocx = (page: Page, fileName = 'services-agreement.docx') =>
  download(page, fileName, page.getByRole('button', { name: 'Download DOCX' }))

test('opens from its tab and previews the sample agreement', async ({ page }) => {
  await expect(page.getByRole('tab', { name: 'Contract generator' })).toHaveAttribute('aria-selected', 'true')
  const preview = pages(page).first()
  await expect(preview).toContainText('Services Agreement')
  await expect(preview).toContainText('Harbor & Finch Ltd.')
  await expect(preview).toContainText('Brightline Studio Ltd.')
  await expect(preview).toContainText('Contents')
  await expect(page.locator('[data-docx-preview]')).toContainText('Schedule A – Services and Fees')
  // The contents list the numbered clause titles.
  await expect(preview).toContainText('1. Definitions')
  await expect(preview).toContainText('3. Fees and payment')
  await expect(page.locator('[data-docx-preview]')).toContainText('Signatures')
})

test('optional clauses come and go in the preview and in the file', async ({ page }) => {
  const preview = page.locator('[data-docx-preview]')
  await expect(preview).toContainText('Confidentiality')
  await expect(preview).not.toContainText('Non-solicitation')

  await page.getByLabel('Non-solicitation').check()
  await page.getByLabel('Confidentiality').uncheck()
  await expect(preview).toContainText('Non-solicitation')
  await expect(preview).not.toContainText('Confidentiality')

  const { paragraphs } = await readDocx(await downloadDocx(page))
  expect(paragraphs).toContain('Non-solicitation')
  expect(paragraphs).not.toContain('Confidentiality')
  // The definition of Confidential Information goes with the clause.
  expect(paragraphs.some((text) => text.includes('"Confidential Information" means'))).toBe(false)
})

test('the termination clause follows its toggle and notice period', async ({ page }) => {
  await page.getByLabel('Notice (days)').fill('45')
  await expect(page.locator('[data-docx-preview]')).toContainText("45 days' written notice")
  await page.getByLabel('Termination for convenience').uncheck()
  await expect(page.locator('[data-docx-preview]')).not.toContainText('for any reason')
  await expect(page.getByLabel('Notice (days)')).toBeDisabled()
})

test('an hourly fee shows the rate, the estimate and their product', async ({ page }) => {
  await page.getByLabel('Fee basis').selectOption('hourly')
  await page.getByLabel('Rate per hour').fill('150')
  await page.getByLabel('Estimated hours').fill('40')
  await expect(page.locator('[data-docx-preview]')).toContainText('Estimated total')
  const { paragraphs } = await readDocx(await downloadDocx(page))
  expect(paragraphs).toEqual(expect.arrayContaining(['Hourly rate', '€150.00', '40', '€6,000.00']))
})

test('the file has numbered clauses, a footnote, a table of contents and page fields', async ({ page }) => {
  const file = await readDocx(await downloadDocx(page))
  const numbering = await file.read('word/numbering.xml')
  expect(numbering).toContain('<w:abstractNum')
  expect(numbering).toContain('w:val="%1.%2."')
  expect(file.xml).toContain('<w:numPr>')
  // Each clause title is a heading that keeps its number, so Word's navigation pane lists it.
  const clauseTitle = file.xml
    .split('</w:p>')
    .find((part) => part.includes('Fees and payment') && part.includes('Heading2'))
  expect(clauseTitle).toContain('<w:numPr>')

  const footer = file.files.find((name) => /^word\/footer\d*\.xml$/.test(name))!
  const footerXml = await file.read(footer)
  expect(footerXml).toContain('PAGE')
  expect(footerXml).toContain('NUMPAGES')

  expect(await file.read('word/footnotes.xml')).toContain('Interest on late payment')
  expect(file.xml).toContain('TOC')
  expect(file.paragraphs).toEqual(expect.arrayContaining(['Signature', 'Name: Priya Raman', 'Name: Maeve Brennan']))
  expect(file.paragraphs).toContain('Schedule A – Services and Fees')
})

test('drops the table of contents on request', async ({ page }) => {
  await page.getByLabel('Table of contents').uncheck()
  await expect(page.locator('[data-docx-preview]')).not.toContainText('Contents')
  expect((await readDocx(await downloadDocx(page))).xml).not.toContain('TOC')
})

test('edits deliverables', async ({ page }) => {
  await expect(page.locator('[data-deliverable]')).toHaveCount(3)
  await page.getByRole('button', { name: 'Add deliverable' }).click()
  const added = page.locator('[data-deliverable]').last()
  await added.getByLabel('Deliverable', { exact: true }).fill('Training')
  await added.getByLabel(/Includes/).fill('Two workshops\nA recorded session')
  await expect(page.locator('[data-docx-preview]')).toContainText('Training')
  await expect(page.locator('[data-docx-preview]')).toContainText('A recorded session')
  await page.locator('[data-deliverable]').first().getByRole('button', { name: 'Remove deliverable' }).click()
  await expect(page.locator('[data-docx-preview]')).not.toContainText('Discovery and planning')
})

test('keeps the draft across reloads', async ({ page }) => {
  await page.locator('#contract-title').fill('Consulting Agreement')
  await page.reload()
  await expect(page.locator('#contract-title')).toHaveValue('Consulting Agreement')
  await expect(pages(page).first()).toContainText('Consulting Agreement')
  await downloadDocx(page, 'consulting-agreement.docx')
})

test('exports, imports and rejects bad files', async ({ page }) => {
  const file = await download(page, 'services-agreement.json', page.getByRole('button', { name: 'Export JSON' }))
  const exported = JSON.parse(await readFile(await file.path(), 'utf8')) as Record<string, unknown>

  const upload = (name: string, data: unknown) =>
    page.locator('[data-import-input]').setInputFiles({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(data)),
    })

  await upload('ok.json', { ...exported, title: 'Imported Agreement' })
  await expect(page.locator('#contract-title')).toHaveValue('Imported Agreement')

  const bad: Record<string, unknown> = {
    'a null party': { ...exported, client: null },
    'an unknown law': { ...exported, governingLaw: 'mars' },
    'a bad fee type': { ...exported, feeType: 'barter' },
    'a text term': { ...exported, termMonths: 'long' },
    'an invalid date': { ...exported, effectiveDate: 'soon' },
    'an empty deliverable': { ...exported, deliverables: [{}] },
    'something else': { hello: 1 },
  }
  for (const [name, data] of Object.entries(bad)) {
    await upload('bad.json', data)
    await expect(page.getByRole('alert'), name).toHaveText("bad.json isn't a file exported from this generator.")
    await expect(page.locator('#contract-title'), name).toHaveValue('Imported Agreement')
    await expect(page.locator('[data-deliverable]'), name).toHaveCount(3)
  }

  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.locator('[data-deliverable]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page.locator('#contract-title')).toHaveValue('Services Agreement')
})

test('ignores a broken saved draft', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('vue-docx-document:contract', '{"title":"x","client":null}'))
  await page.reload()
  await expect(page.locator('#contract-title')).toHaveValue('Services Agreement')
})
