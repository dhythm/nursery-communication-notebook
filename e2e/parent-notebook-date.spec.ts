import { expect, test, type Locator, type Page } from '@playwright/test'
import type { NotebookEntry } from '../lib/types'

const parentPath = '/nurseries/nijiiro/parent'
const notebookApi = '/api/nurseries/nijiiro/notebook'

test.use({ viewport: { width: 390, height: 844 } })

async function saveEntry(page: Page, dialog: Locator, buttonName: string) {
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === notebookApi && response.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: buttonName, exact: true }).click()
  expect((await saved).status()).toBe(200)
  await expect(dialog).toBeHidden()
}

async function readEntry(page: Page, date: string) {
  const response = await page.request.get(notebookApi)
  expect(response.ok()).toBeTruthy()
  const data = (await response.json()) as { notebookEntries: NotebookEntry[] }
  return data.notebookEntries.find(
    (entry) => entry.childId === 'c1' && entry.author === 'parent' && entry.date === date,
  )
}

test('a parent drafts tomorrow at night and submits the same entry the following morning', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2036-09-11T21:00:00+09:00'))
  await page.goto(parentPath)
  await expect(page.getByLabel('連絡帳の日付')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '明日', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /子どもの様子を登録する/ })).toContainText(
    '9月12日（金）',
  )
  await page.screenshot({ path: '/tmp/nursery-parent-date-composer.png', fullPage: true })
  await page.getByRole('button', { name: '子どもの様子を登録する' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('9月12日（金）')
  await page.screenshot({ path: '/tmp/nursery-parent-date-dialog.png', fullPage: true })
  await dialog.getByLabel('夕食内容').fill('ご飯、焼き魚、みそ汁')
  await dialog.getByLabel('就寝時間').fill('21:00')
  await dialog.getByLabel('前夜の排便の状態').selectOption('normal')
  const note = `明日分の下書き ${Date.now()}`
  await dialog.getByLabel('連絡事項').fill(note)
  await expect(dialog.getByLabel('起床時間')).toHaveValue('')
  await expect(dialog.getByLabel('朝食内容')).toHaveValue('')
  await saveEntry(page, dialog, '下書き保存')

  const draft = await readEntry(page, '2036-09-12')
  expect(draft).toMatchObject({
    status: 'draft',
    note,
    eveningMeal: 'ご飯、焼き魚、みそ汁',
  })
  expect(draft?.wakeTime).toBeFalsy()
  expect(draft?.breakfast).toBeFalsy()
  await expect(page.getByText(note, { exact: true })).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: '子どもの様子を登録する' }).click()
  await expect(dialog).toHaveAccessibleName('ひなた の様子を編集')
  await expect(dialog.getByLabel('夕食内容')).toHaveValue('ご飯、焼き魚、みそ汁')
  await expect(dialog.getByLabel('連絡事項')).toHaveValue(note)
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click()

  await page.clock.setFixedTime(new Date('2036-09-12T07:00:00+09:00'))
  await page.reload()
  await expect(page.getByRole('button', { name: /子どもの様子を登録する/ })).toContainText(
    '9月12日（金）',
  )
  await page.getByRole('button', { name: '子どもの様子を登録する' }).click()
  await expect(dialog).toHaveAccessibleName('ひなた の様子を編集')
  await expect(dialog).toContainText('9月12日（金）')
  await dialog.getByLabel('起床時間').fill('06:30')
  await dialog.getByLabel('体温').fill('36.6')
  await dialog.getByLabel('検温時刻').fill('07:00')
  await dialog.getByLabel('当日朝の排便の状態').selectOption('none')
  await dialog.getByLabel('朝食内容').fill('トースト、バナナ、牛乳')
  await dialog.getByLabel('お迎え予定時刻').fill('17:30')
  await saveEntry(page, dialog, 'この内容で送信')

  expect(await readEntry(page, '2036-09-12')).toMatchObject({
    id: draft!.id,
    date: '2036-09-12',
    status: 'published',
    note,
    breakfast: 'トースト、バナナ、牛乳',
    wakeTime: '06:30',
  })
  await page.reload()
  await expect(page.getByText(note, { exact: true })).toBeVisible()
})

test('the weekend home action opens Monday and the notebook list resumes that draft', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2036-09-13T10:00:00+09:00'))
  await page.goto(parentPath)
  await expect(page.getByLabel('連絡帳の日付')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /子どもの様子を登録する/ })).toContainText(
    '9月15日（月）',
  )
  await page.getByRole('button', { name: '子どもの様子を登録する' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('9月15日（月）')
  const note = `月曜日の連絡 ${Date.now()}`
  await dialog.getByLabel('連絡事項').fill(note)
  await saveEntry(page, dialog, '下書き保存')
  const draft = await readEntry(page, '2036-09-15')
  expect(draft).toMatchObject({ status: 'draft', note })

  await page.clock.setFixedTime(new Date('2036-09-14T20:00:00+09:00'))
  await page.reload()
  await expect(page.getByRole('button', { name: /子どもの様子を登録する/ })).toContainText(
    '9月15日（月）',
  )
  await page.getByRole('button', { name: '子どもの様子を登録する' }).click()
  await expect(dialog).toHaveAccessibleName('ひなた の様子を編集')
  await expect(dialog.getByLabel('連絡事項')).toHaveValue(note)
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click()
  await page.goto(`${parentPath}/notebook`)
  await page.getByLabel('連絡帳の日付').fill('2036-09-15')
  await expect(page.getByLabel('連絡帳の日付')).toHaveValue('2036-09-15')
  await page.getByRole('button', { name: '記入', exact: true }).click()
  await expect(dialog).toHaveAccessibleName('ひなた の様子を編集')
  await expect(dialog.getByLabel('連絡事項')).toHaveValue(note)
  await dialog.getByLabel('夕食内容').fill('ご飯、煮物')
  await saveEntry(page, dialog, '下書き保存')
  expect(await readEntry(page, '2036-09-15')).toMatchObject({
    id: draft!.id,
    status: 'draft',
    note,
    eveningMeal: 'ご飯、煮物',
  })
})

test('a confirmed entry for today does not prevent selecting a future date', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2036-09-20T20:00:00+09:00'))
  await page.route('**/api/nurseries/nijiiro/notebook?*', async (route) => {
    const response = await route.fetch()
    const data = (await response.json()) as { notebookEntries: NotebookEntry[] }
    const existing = data.notebookEntries.find(
      (entry) => entry.childId === 'c1' && entry.author === 'parent',
    )
    expect(existing).toBeDefined()
    data.notebookEntries = [
      ...data.notebookEntries.filter((entry) => entry.date !== '2036-09-20'),
      {
        ...existing!,
        id: 'confirmed-today-fixture',
        date: '2036-09-20',
        status: 'published',
        confirmedAt: '2036-09-20T10:00:00+09:00',
        confirmedByName: '山田 めぐみ',
      },
    ]
    await route.fulfill({ response, json: data })
  })
  await page.goto(`${parentPath}/notebook`)
  await page.getByLabel('連絡帳の日付').fill('2036-09-20')
  await expect(page.getByRole('button', { name: '園で確認済みです' })).toBeDisabled()
  await page.getByLabel('連絡帳の日付').fill('2036-09-24')
  await page.getByRole('button', { name: '記入', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'ひなた の様子を登録' })
  await expect(dialog).toContainText('9月24日（水）')
  await expect(dialog.getByLabel('連絡事項')).toHaveValue('')
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click()
  await page.getByLabel('連絡帳の日付').fill('2036-09-20')
  await expect(page.getByRole('button', { name: '園で確認済みです' })).toBeDisabled()
})

test('the home target advances at noon while an open editor keeps its original date', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2036-09-22T11:59:00+09:00') })
  await page.goto(parentPath)
  const register = page.getByRole('button', { name: /子どもの様子を登録する/ })
  await expect(register).toContainText('9月22日（月）')
  await page.clock.pauseAt(new Date('2036-09-22T11:59:59+09:00'))
  await page.clock.runFor(1_000)
  await expect(register).toContainText('9月23日（火）')
  await register.click()
  const dialog = page.getByRole('dialog', { name: 'ひなた の様子を登録' })
  await expect(dialog).toContainText('9月23日（火）')

  await page.clock.fastForward(24 * 60 * 60 * 1_000)
  await expect(dialog).toContainText('9月23日（火）')
  await expect(dialog).not.toContainText('9月24日（水）')
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click()
  await expect(register).toContainText('9月24日（水）')
})
