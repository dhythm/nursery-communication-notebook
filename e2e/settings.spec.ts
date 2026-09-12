import { expect, test } from '@playwright/test'

const settingsPath = '/nurseries/nijiiro/parent/settings'

test('setting pages have working parent navigation', async ({ page }) => {
  await page.goto(settingsPath)

  await page.getByRole('link', { name: /田中 ひなた/ }).click()
  await expect(page).toHaveURL(`${settingsPath}/children/c1`)
  await expect(page.getByRole('heading', { name: 'お子さまの情報' })).toBeVisible()
  await expect(page.getByText('2021年6月15日')).toBeVisible()
  await page.getByRole('link', { name: '設定に戻る' }).click()
  await expect(page).toHaveURL(settingsPath)

  for (const section of ['privacy', 'terms']) {
    await page.goto(`${settingsPath}/${section}`)
    await page.getByRole('link', { name: '設定に戻る' }).click()
    await expect(page).toHaveURL(settingsPath)
  }

  await page.getByRole('link', { name: 'ヘルプ' }).click()
  await expect(page.getByRole('heading', { name: 'ヘルプ', exact: true })).toBeVisible()
  await expect(page.getByText('お問い合わせ')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '園へ連絡する' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'X（@dhythm_dev）' })).toHaveAttribute(
    'href',
    'https://x.com/dhythm_dev',
  )
})

test('a parent cannot open an unlinked child from a direct URL', async ({ page }) => {
  await page.goto(`${settingsPath}/children/c3`)
  await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible()
  await expect(page.getByText('佐藤 はると')).toHaveCount(0)
})
