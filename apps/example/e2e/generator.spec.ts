import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { download, frameSrc, readDocx, readHeader, readPdfText, watchErrors } from './helpers'

// A 1×1 PNG, for the logo upload.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
)

let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = watchErrors(page)
  await page.goto('/#generator')
  await expect(pages(page).first()).toBeVisible({ timeout: 15_000 })
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

const pages = (page: Page) => page.locator('[data-docx-page]')
const total = (page: Page, name: 'subtotal' | 'vat' | 'total') => page.locator(`[data-total="${name}"]`)
const downloadDocx = (page: Page, fileName: string) =>
  download(page, fileName, page.getByRole('button', { name: 'Download DOCX' }))

const showPdf = async (page: Page) => {
  await page.locator('[data-format="pdf"]').click()
  await expect(page.locator('[data-status]')).toHaveText(/^Ready/, { timeout: 30_000 })
  return frameSrc(page.locator('[data-pdf-viewer]'))
}

test('opens from its tab and previews the sample invoice as a Word document', async ({ page }) => {
  await expect(page.getByRole('tab', { name: 'Invoice generator' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-format="docx"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(pages(page).first()).toContainText('INVOICE')
  await expect(pages(page).first()).toContainText('Harbor & Finch Ltd.')

  await expect(total(page, 'subtotal')).toHaveText('€7,399.80')
  await expect(total(page, 'vat')).toHaveText('€1,690.78')
  await expect(total(page, 'total')).toHaveText('€9,090.58')
})

test('switches tabs with the keyboard and the URL', async ({ page }) => {
  const generatorTab = page.getByRole('tab', { name: 'Invoice generator' })
  await generatorTab.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeFocused()
  await expect(page.locator('#example-minimal')).toBeVisible()
  await page.goBack()
  await expect(generatorTab).toHaveAttribute('aria-selected', 'true')
})

test('recomputes totals per VAT rate as items change', async ({ page }) => {
  await page.getByRole('button', { name: 'Add item' }).click()
  const row = page.locator('[data-item]').last()
  await row.getByLabel('Description').fill('Hosting')
  await row.getByLabel('Quantity').fill('2')
  await row.getByLabel('Unit price').fill('100')
  await row.getByLabel('VAT rate').selectOption('13.5')

  await expect(total(page, 'subtotal')).toHaveText('€7,599.80')
  await expect(total(page, 'vat')).toHaveText('€1,717.78')
  await expect(total(page, 'total')).toHaveText('€9,317.58')
  await expect(pages(page).first()).toContainText('Hosting')

  await page.getByLabel('Supplier is a VAT payer').uncheck()
  await expect(total(page, 'vat')).toHaveCount(0)
  await expect(total(page, 'total')).toHaveText('€7,599.80')
})

test('downloads the Word file named after the invoice number, with its items and totals', async ({ page }) => {
  await page.locator('#gen-number').fill('2026-777')
  const file = await downloadDocx(page, 'invoice-2026-777.docx')
  const { paragraphs } = await readDocx(file)
  expect(paragraphs).toContain('No. 2026-777')
  expect(paragraphs).toEqual(
    expect.arrayContaining(['Discovery workshop', 'Front-end development', '€9,090.58', 'Issued by: Maeve Brennan']),
  )
})

test('downloads the same invoice as a PDF', async ({ page }) => {
  await page.locator('#gen-number').fill('2026-778')
  const file = await download(page, 'invoice-2026-778.pdf', page.getByRole('button', { name: 'Download PDF' }))
  expect(await readHeader(file)).toBe('%PDF-')
  // The PDF engine loads on the first request, so the button comes back afterwards.
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
})

test('shows the PDF preview and switches back', async ({ page }) => {
  const src = await showPdf(page)
  const pdf = await readPdfText(page, src)
  expect(pdf.startsWith('%PDF-')).toBe(true)
  expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Roboto-Regular/)
  await expect(page.locator('[data-status]')).toHaveText('Ready · 1 page')

  await page.locator('[data-format="docx"]').click()
  await expect(pages(page).first()).toBeVisible()
})

test('writes the invoice language into both files', async ({ page }) => {
  await page.getByLabel('Language of the invoice').selectOption('sk')
  await expect(pages(page).first()).toContainText('FAKTÚRA')
  await expect(pages(page).first()).toContainText('Dodávateľ')

  const number = await page.locator('#gen-number').inputValue()
  const { paragraphs, read } = await readDocx(await downloadDocx(page, `invoice-${number}.docx`))
  expect(paragraphs).toContain('FAKTÚRA')
  expect(await read('word/footer1.xml')).toContain('Strana')
  expect(await read('word/styles.xml')).toContain('w:lang w:val="sk-SK"')

  const pdf = await readPdfText(page, await showPdf(page))
  expect(pdf).toContain('/Lang (sk)')
})

test('drops the QR code when it is turned off, and draws an uploaded logo', async ({ page }) => {
  const name = `invoice-${await page.locator('#gen-number').inputValue()}.docx`
  const media = async () =>
    (await readDocx(await downloadDocx(page, name))).files.filter((f) => f.startsWith('word/media/'))

  await expect(page.locator('[data-docx-page] img')).toHaveCount(1)
  expect(await media()).toHaveLength(1)

  await page.getByLabel(/Payment QR code/).uncheck()
  await expect(page.locator('[data-docx-page] img')).toHaveCount(0)
  expect(await media()).toHaveLength(0)

  await page.locator('[data-logo-input]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByAltText('Logo preview')).toBeVisible()
  await expect(page.locator('[data-docx-page] img')).toHaveCount(1)
  expect(await media()).toHaveLength(1)
})

test('keeps the draft across reloads', async ({ page }) => {
  await page.locator('#buyer-name').fill('Contoso Ltd.')
  await page.reload()
  await expect(page.locator('#buyer-name')).toHaveValue('Contoso Ltd.')
  await expect(pages(page).first()).toContainText('Contoso Ltd.')
})

test('exports and imports the invoice as JSON', async ({ page }) => {
  const number = await page.locator('#gen-number').inputValue()
  const file = await download(page, `invoice-${number}.json`, page.getByRole('button', { name: 'Export JSON' }))
  const exported = JSON.parse(await readFile(await file.path(), 'utf8')) as { number: string; items: unknown[] }
  expect(exported.items).toHaveLength(4)

  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.locator('[data-item]')).toHaveCount(0)
  await expect(total(page, 'total')).toHaveText('€0.00')

  const edited = { ...exported, number: 'IMPORTED-1' }
  await page.locator('[data-import-input]').setInputFiles({
    name: 'invoice.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(edited)),
  })
  await expect(page.locator('#gen-number')).toHaveValue('IMPORTED-1')
  await expect(page.locator('[data-item]')).toHaveCount(4)

  await page.locator('[data-import-input]').setInputFiles({
    name: 'nope.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":1}'),
  })
  await expect(page.getByRole('alert')).toHaveText("nope.json isn't a file exported from this generator.")
})

test('paginates long invoices in both formats', async ({ page }) => {
  const number = await page.locator('#gen-number').inputValue()
  const exportFile = await download(page, `invoice-${number}.json`, page.getByRole('button', { name: 'Export JSON' }))
  const invoice = JSON.parse(await readFile(await exportFile.path(), 'utf8')) as { items: { id: number }[] }
  const extra = Array.from({ length: 30 }, (_, i) => ({ ...invoice.items[0], id: 100 + i, description: `Item ${i}` }))
  await page.locator('[data-import-input]').setInputFiles({
    name: 'long.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...invoice, items: [...invoice.items, ...extra] })),
  })
  await expect(page.locator('[data-item]')).toHaveCount(34)
  // The exact count depends on fonts and spacing; what must hold is that the item table
  // repeats its header on every page, the footer counts the pages, and the totals come last.
  await expect(pages(page).last()).toContainText('Item 29', { timeout: 15_000 })
  const count = await pages(page).count()
  expect(count).toBeGreaterThan(1)
  for (let index = 0; index < count; index++) {
    const sheet = pages(page).nth(index)
    await expect(sheet).toContainText('Description')
    await expect(sheet).toContainText(`Page ${index + 1} of ${count}`)
  }
  await expect(pages(page).last()).toContainText('Item 29')
  await expect(pages(page).last()).toContainText('Amount due')

  await showPdf(page)
  await expect(page.locator('[data-status]')).toHaveText(/^Ready · [2-9] pages$/, { timeout: 30_000 })
})

test('refuses invoices that would break the renderer and keeps the current one', async ({ page }) => {
  const number = await page.locator('#gen-number').inputValue()
  const file = await download(page, `invoice-${number}.json`, page.getByRole('button', { name: 'Export JSON' }))
  const good = JSON.parse(await readFile(await file.path(), 'utf8')) as {
    items: Record<string, unknown>[]
    payment: object
    buyer: object
  }
  const item = good.items[0]

  const bad: Record<string, unknown> = {
    'a null party': { ...good, seller: null },
    'an unknown language': { ...good, language: 'de' },
    'an unknown currency': { ...good, currency: 'EURO' },
    'an unknown payment method': { ...good, payment: { ...good.payment, method: 'barter' } },
    'an invalid date': { ...good, dueDate: '2026-13-45' },
    'an empty item': { ...good, items: [{}, item] },
    'a text quantity': { ...good, items: [{ ...item, quantity: 'many' }] },
    'a discount above 100': { ...good, items: [{ ...item, discount: 150 }] },
    'a party field of the wrong type': { ...good, buyer: { ...good.buyer, name: 7 } },
    'a bad accent color': { ...good, accent: 'teal' },
    'a logo that is not an image': { ...good, logo: 'javascript:alert(1)' },
  }
  for (const [name, invoice] of Object.entries(bad)) {
    await page.locator('[data-import-input]').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(invoice)),
    })
    await expect(page.getByRole('alert'), name).toHaveText("bad.json isn't a file exported from this generator.")
    await expect(page.locator('#gen-number'), name).toHaveValue(number)
    await expect(page.locator('[data-item]'), name).toHaveCount(4)
    await expect(pages(page).first(), name).toContainText('Harbor & Finch Ltd.')
  }

  // Missing optional fields come from a blank invoice instead of the draft that was open.
  await page.locator('[data-import-input]').setInputFiles({
    name: 'small.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ number: 'S-1', seller: {}, buyer: {}, payment: {}, items: [] })),
  })
  await expect(page.locator('#gen-number')).toHaveValue('S-1')
  await expect(page.locator('#buyer-name')).toHaveValue('')
  await expect(page.locator('[data-item]')).toHaveCount(0)
})

test('ignores a broken saved draft', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'vue-docx-document:invoice',
      JSON.stringify({ number: 'X', seller: null, buyer: {}, payment: {}, items: [] }),
    ),
  )
  await page.reload()
  await expect(pages(page).first()).toContainText('Harbor & Finch Ltd.')
  await expect(page.locator('[data-item]')).toHaveCount(4)
})

test('draws no QR code without a supplier name', async ({ page }) => {
  await expect(page.locator('[data-docx-page] img')).toHaveCount(1)
  await page.locator('#seller-name').fill('')
  await expect(page.getByText(/The QR code needs EUR, a supplier name/)).toBeVisible()
  await expect(page.locator('[data-docx-page] img')).toHaveCount(0)
  await page.locator('#seller-name').fill('Brightline Studio Ltd.')
  await expect(page.locator('[data-docx-page] img')).toHaveCount(1)
})
