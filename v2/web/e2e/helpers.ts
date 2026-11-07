import { mkdir } from 'node:fs/promises'
import { expect, type Page, type TestInfo } from '@playwright/test'
import type { Session } from '../src/domain'

export const reviewDirectory = '/tmp/tiantai-v2-qa'

export async function capture(page: Page, name: string, testInfo: TestInfo) {
  await mkdir(reviewDirectory, { recursive: true })
  const path = `${reviewDirectory}/${name}.png`
  await expect.poll(() => page.locator('.rooftop-art').evaluate((element) => {
    const artwork = element as HTMLImageElement
    return artwork.complete && artwork.naturalWidth > 0
  })).toBe(true)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  if (await page.locator('.observation-photo img').count()) {
    await expect.poll(() => page.locator('.observation-photo img').evaluate((element) => {
      const artwork = element as HTMLImageElement
      return artwork.complete && artwork.naturalWidth > 0
    })).toBe(true)
  }
  // Normalize scroll before full-page capture so fixed elements retain their
  // actual viewport position rather than being offset by the last clicked item.
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

export async function currentSession(page: Page): Promise<Session> {
  const id = await page.evaluate(() => localStorage.getItem('tiantai:v2:session'))
  expect(id).toMatch(/^[a-f0-9]{64}$/)
  const response = await page.request.get(`/api/v2/sessions/${id}`)
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<Session>
}

export async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1)
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1)
}

export async function expectWithinViewport(page: Page, selector: string) {
  const element = page.locator(selector)
  await expect(element).toBeVisible()
  const box = await element.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1)
}
