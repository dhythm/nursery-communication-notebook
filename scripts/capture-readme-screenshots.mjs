import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const baseURL = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:3100'
const outputDirectory = resolve('docs/screenshots')
const viewport = { width: 390, height: 844 }

await mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch()
let context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
let page = await context.newPage()

async function capture(name) {
  await page.screenshot({ path: resolve(outputDirectory, `${name}.png`), fullPage: false })
}

try {
  await page.goto(`${baseURL}/nurseries/nijiiro/parent`)
  await page.getByRole('heading', { name: 'こんにちは、田中さん' }).waitFor()
  await capture('parent-home')

  await page.goto(`${baseURL}/nurseries/nijiiro/parent/notebook`)
  await page.getByRole('heading', { name: '連絡帳' }).waitFor()
  await capture('parent-notebook')

  await page.goto(`${baseURL}/nurseries/nijiiro/parent/notices`)
  await page.getByRole('heading', { name: 'お知らせ' }).waitFor()
  await page.getByRole('button', { name: '詳細を確認' }).first().click()
  await page.getByRole('dialog').waitFor()
  await capture('parent-notice-detail')

  await context.close()
  context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  await context.addCookies([
    {
      name: 'nursery-development-role',
      value: 'teacher',
      url: baseURL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  page = await context.newPage()
  await page.goto(`${baseURL}/nurseries/nijiiro/teacher`)
  await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor()
  await capture('teacher-dashboard')

  await page.goto(`${baseURL}/nurseries/nijiiro/teacher/children`)
  await page.getByRole('heading', { name: '園児管理' }).waitFor()
  await capture('teacher-children')

  await page.goto(`${baseURL}/nurseries/nijiiro/teacher/messages`)
  await page.getByRole('heading', { name: 'メッセージ' }).waitFor()
  await capture('teacher-messages')
} finally {
  await browser.close()
}
