import { expect, test } from '@playwright/test'

import { watchErrors } from './helpers'

const WIDTHS = [1440, 1024, 768, 375]
const PAGES = ['/', '/#generator', '/#contract']

for (const width of WIDTHS) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height: 900 } })

    for (const path of PAGES) {
      test(`${path} does not scroll sideways`, async ({ page }) => {
        const errors = watchErrors(page)
        await page.goto(path)
        await expect(page.locator('[data-docx-page]').first()).toBeVisible({ timeout: 15_000 })
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBeLessThanOrEqual(0)
        expect(errors).toEqual([])
      })
    }

    for (const path of ['/#generator', '/#contract']) {
      test(`${path} keeps every control and page inside its card`, async ({ page }) => {
        await page.goto(path)
        await expect(page.locator('[data-docx-page]').first()).toBeVisible({ timeout: 15_000 })
        // Let the preview settle on its fitted scale.
        await page.waitForTimeout(300)

        const offenders = await page.evaluate(() => {
          const found: string[] = []
          const describe = (el: Element) => `${el.tagName.toLowerCase()}.${el.className || ''}`.slice(0, 80)

          for (const card of document.querySelectorAll('.gen-section, .gen-preview')) {
            const box = card.getBoundingClientRect()
            for (const el of card.querySelectorAll('*')) {
              if (el.closest('.viewer, .sr-only, legend, [data-pdf-viewer]') || el.matches('.sr-only')) continue
              const rect = el.getBoundingClientRect()
              if (rect.width === 0 && rect.height === 0) continue
              if (rect.right > box.right + 1 || rect.left < box.left - 1) found.push(`outside: ${describe(el)}`)
              if (el.scrollWidth > el.clientWidth + 1 && !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
                found.push(`clipped: ${describe(el)}`)
              }
            }
          }

          for (const viewer of document.querySelectorAll('.viewer')) {
            const box = viewer.getBoundingClientRect()
            if (viewer.scrollWidth > viewer.clientWidth + 1) found.push('viewer scrolls sideways')
            for (const sheet of viewer.querySelectorAll('[data-docx-page]')) {
              const rect = sheet.getBoundingClientRect()
              if (rect.right > box.right + 1 || rect.left < box.left - 1) found.push('a page is cut off by the viewer')
            }
          }
          return found
        })
        expect(offenders).toEqual([])
      })
    }
  })
}
