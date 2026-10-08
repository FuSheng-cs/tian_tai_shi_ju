import { defineConfig } from '@playwright/test'

const baseURL = process.env.V2_BASE_URL ?? 'http://127.0.0.1:5174'
const target = new URL(baseURL)
const hostname = target.hostname.toLowerCase().replace(/\.+$/, '')
if (!['127.0.0.1', 'localhost', '::1', '[::1]', 'v2.tiantaishiju.top'].includes(hostname)
  || !['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
  throw new Error('V2 acceptance tests may run only against local V2 or v2.tiantaishiju.top.')
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? '/tmp/tiantai-v2-qa/results',
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_USE_BUNDLED === '1' ? {} : {
      executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
      args: ['--no-sandbox'],
    },
  },
})
