import { expect, test } from '@playwright/test'

const teacherPath = '/nurseries/nijiiro/teacher'

test('a teacher can restore drafts and reuse custom message templates', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL(teacherPath)
  await page.goto(`${teacherPath}/messages`)

  const composer = page.getByPlaceholder('メッセージを入力')
  const draft = `下書きメッセージ ${Date.now()}`
  await composer.fill(draft)
  await expect(page.getByText('下書き保存済み', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByPlaceholder('メッセージを入力')).toHaveValue(draft)

  await page.getByRole('button', { name: '本日の様子', exact: true }).click()
  await expect(page.getByPlaceholder('メッセージを入力')).toHaveValue(
    /本日も元気に過ごしています。/,
  )

  const templateText = `お迎えについてご確認ください。${Date.now()}`
  await page.getByPlaceholder('メッセージを入力').fill(templateText)
  await page.getByRole('button', { name: 'テンプレート保存', exact: true }).click()
  await page.getByLabel('テンプレート名').fill('お迎え確認')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('button', { name: 'お迎え確認', exact: true })).toBeVisible()

  await page.getByPlaceholder('メッセージを入力').fill('')
  await page.reload()
  await page.getByRole('button', { name: 'お迎え確認', exact: true }).click()
  await expect(page.getByPlaceholder('メッセージを入力')).toHaveValue(templateText)

  await page.getByRole('button', { name: 'お迎え確認を削除', exact: true }).click()
  await expect(page.getByRole('button', { name: 'お迎え確認', exact: true })).toHaveCount(0)
})
