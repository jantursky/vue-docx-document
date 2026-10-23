import { expect, test } from '@playwright/test'

// A phone-sized screen must not scroll sideways.
test.use({ viewport: { width: 360, height: 740 } })

for (const path of ['/', '/#generator']) {
  test(`${path} fits a 360 px screen`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('[data-docx-page]').first()).toBeVisible({ timeout: 15_000 })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}
