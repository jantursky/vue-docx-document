import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

// WCAG 2.2 A and AA. Inside the document previews, colors are the document author's, so
// contrast is checked everywhere except there; every other rule covers the pages too.
// The PDF frame shows the browser's own viewer and is left out.
const audit = async (page: Page) => {
  const outside = await new AxeBuilder({ page }).withTags(TAGS).exclude('[data-docx-page]').exclude('iframe').analyze()
  // The PDF preview shows no pages to include.
  const hasPages = (await page.locator('[data-docx-page]').count()) > 0
  const pages = hasPages
    ? (
        await new AxeBuilder({ page })
          .withTags(TAGS)
          .include('[data-docx-page]')
          .disableRules(['color-contrast'])
          .analyze()
      ).violations
    : []
  return [...outside.violations, ...pages].map(
    ({ id, help, nodes }) => `${id}: ${help} (${nodes.map((node) => node.target.join(' ')).join(', ')})`,
  )
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme })

    test('the overview has no accessibility violations', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('#example-report [data-docx-page]').first()).toBeVisible()
      await page.locator('#example-report').getByRole('button', { name: 'View source' }).click()
      await page.locator('#example-formats').getByRole('button', { name: 'View source' }).click()
      expect(await audit(page)).toEqual([])
    })

    test('the invoice generator has no accessibility violations', async ({ page }) => {
      await page.goto('/#generator')
      await expect(page.locator('[data-docx-page]').first()).toBeVisible({ timeout: 15_000 })
      expect(await audit(page)).toEqual([])
    })

    test('the invoice generator with a PDF preview has no accessibility violations', async ({ page }) => {
      await page.goto('/#generator')
      await page.locator('[data-format="pdf"]').click()
      await expect(page.locator('[data-status]')).toHaveText(/^Ready/, { timeout: 30_000 })
      expect(await audit(page)).toEqual([])
    })
  })
}
