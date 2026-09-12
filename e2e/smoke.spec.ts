import { expect, test } from '@playwright/test'

test('a parent can sign in and submit a notebook entry', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()

  await expect(page).toHaveURL('/parent')
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
  await page.getByRole('button', { name: '子どもの様子を登録する' }).click()

  const dialog = page.getByRole('dialog', { name: 'ひなた の様子を登録' })
  const note = '今日は自分で靴を履けました。'
  await dialog.getByLabel('連絡・伝えたいこと').fill(note)
  await dialog.getByRole('button', { name: 'この内容で送信' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText(note, { exact: true })).toBeVisible()
})

test('a teacher can open child management and sign out', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await expect(page.getByLabel('メールアドレス')).toHaveValue('yamada@nijiiro.ed.jp')
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()

  await expect(page).toHaveURL('/teacher')
  await expect(page.getByRole('heading', { name: 'ダッシュボード', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '園児管理へ', exact: true }).click()
  await expect(page).toHaveURL('/teacher/children')
  await expect(page.getByRole('heading', { name: '園児管理', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '田中 ひなた', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'ログイン', exact: true })).toBeVisible()
})

test('a protected page redirects visitors to sign in', async ({ page }) => {
  await page.goto('/teacher/children')

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'ログイン', exact: true })).toBeVisible()
})
