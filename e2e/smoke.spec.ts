import { expect, test } from '@playwright/test'

test('a parent can edit and submit a notebook entry', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()

  await expect(page).toHaveURL('/parent')
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
  await page.getByRole('button', { name: '子どもの様子を登録する' }).click()

  const dialog = page.getByRole('dialog', { name: 'ひなた の様子を編集' })
  const note = `今日は自分で靴を履けました。${Date.now()}`
  await dialog.getByLabel('連絡・伝えたいこと').fill(note)
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/notebook') && response.request().method() === 'POST',
  )
  await dialog.getByRole('button', { name: 'この内容で送信' }).click()
  const result = await saved
  expect(result.status()).toBe(200)

  await expect(dialog).toBeHidden()
  await expect(page.getByText(note, { exact: true })).toBeVisible()
  await page.reload()
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

test('child and calendar forms open with the currently selected target', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL('/teacher')
  await page.goto('/teacher/children')

  await page.getByRole('button', { name: /田中 あおい/ }).click()
  await page.getByRole('button', { name: '編集', exact: true }).click()
  const childDialog = page.getByRole('dialog', { name: '園児情報を編集' })
  await expect(childDialog.getByLabel('アレルギー（読点や空白で区切り）')).toHaveValue('')
  await expect(childDialog.getByLabel('申し送り・メモ')).toHaveValue(
    '人見知りが少しあります。だっこが好きです。',
  )
  await childDialog.getByRole('button', { name: 'キャンセル' }).click()

  await page.goto('/teacher/calendar')
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const dateValues = Object.fromEntries(dateParts.map((part) => [part.type, part.value]))
  const selectedDate = `${dateValues.year}-${dateValues.month}-20`
  await page.getByRole('button', { name: '20', exact: true }).click()
  await page.getByRole('button', { name: 'この日に予定を追加' }).click()
  const eventDialog = page.getByRole('dialog', { name: '予定を追加' })
  await expect(eventDialog.getByLabel('日付')).toHaveValue(selectedDate)
})

test('skip mode opens parent pages directly and prevents access to teacher pages', async ({
  page,
}) => {
  await page.goto('/teacher/children')

  await expect(page).toHaveURL('/parent')
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
})

test('the agent server uses PGlite and caches data across page navigation', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBeTruthy()
  expect(await response.json()).toMatchObject({ ok: true, provider: 'pglite', migrationVersion: 5 })
  let readCount = 0
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname === '/api/notebook' &&
      response.request().method() === 'GET' &&
      response.ok()
    )
      readCount += 1
  })
  await page.goto('/parent')
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
  expect(readCount).toBe(1)
  await page.getByRole('link', { name: '連絡帳', exact: true }).click()
  await expect(page).toHaveURL('/parent/notebook')
  await page.getByRole('link', { name: 'ホーム', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
  expect(readCount).toBe(1)
})

test('a teacher publishes an important notice and a parent confirms it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL('/teacher')
  await page.goto('/teacher/notices')
  await page.getByRole('button', { name: '新規作成' }).click()
  const dialog = page.getByRole('dialog', { name: 'お知らせを作成' })
  const title = `確認依頼 ${Date.now()}`
  await dialog.getByLabel('タイトル').fill(title)
  await dialog.getByLabel('本文').fill('内容を確認してください。')
  await dialog.getByLabel('確認を必須にする').check()
  await dialog.getByRole('button', { name: '配信する' }).click()
  await expect(page.getByText(title, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()
  await page.goto('/parent/notices')
  const article = page.getByRole('article').filter({ hasText: title })
  await article.getByRole('button', { name: '詳細を確認' }).click()
  await article.getByRole('button', { name: '確認しました' }).click()
  await expect(article.getByText('確認済み')).toBeVisible()
})

test('a teacher uploads a real PDF that an authorized parent can download', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL('/teacher')
  await page.goto('/teacher/files')
  await page.getByRole('button', { name: '資料をアップロード' }).click()
  const dialog = page.getByRole('dialog', { name: '資料をアップロード' })
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'guide.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nreal file'),
  })
  await dialog.getByRole('button', { name: 'アップロードして共有' }).click()
  await expect(page.getByText('guide.pdf', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()
  await page.goto('/parent/files')
  const download = page.getByRole('link', { name: 'guide.pdfをダウンロード' })
  const response = await page.request.get((await download.getAttribute('href')) ?? '')
  expect(response.status()).toBe(200)
  expect(await response.body()).toEqual(Buffer.from('%PDF-1.7\nreal file'))
})

test('a teacher registers a class, guardian, and child', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL('/teacher')
  await page.goto('/teacher/management')
  const suffix = Date.now()
  const className = `テスト組${suffix}`
  const classCard = page.getByRole('heading', { name: 'クラスを追加' }).locator('..')
  await classCard.getByLabel('クラス名').fill(className)
  const classSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/notebook') && response.request().method() === 'POST',
  )
  await classCard.getByRole('button', { name: '追加' }).click()
  expect((await classSaved).status()).toBe(200)
  const memberCard = page.getByRole('heading', { name: '利用者を追加' }).locator('..')
  await memberCard.getByLabel('氏名').fill(`テスト保護者${suffix}`)
  await memberCard.getByLabel('メールアドレス').fill(`parent-${suffix}@example.com`)
  const memberSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/notebook') && response.request().method() === 'POST',
  )
  await memberCard.getByRole('button', { name: '追加' }).click()
  expect((await memberSaved).status()).toBe(200)
  const childCard = page.getByRole('heading', { name: '園児を入園登録' }).locator('..')
  await childCard.getByLabel('氏名').fill(`テスト園児${suffix}`)
  await childCard.getByLabel('ふりがな').fill('てすと えんじ')
  await childCard.getByLabel('生年月日').fill('2024-04-01')
  await childCard.getByLabel('クラス').selectOption({ label: className })
  await childCard.getByLabel('保護者').selectOption({ label: `テスト保護者${suffix}` })
  await childCard.getByRole('button', { name: '入園登録' }).click()
  await expect(page.getByText(`テスト園児${suffix}`, { exact: true }).first()).toBeVisible()
})

test('the API rejects teacher-only updates and cross-origin requests', async ({ request }) => {
  const denied = await request.post('/api/notebook', {
    data: {
      commandId: 'denied-update',
      type: 'updateChild',
      payload: { id: 'c1', expectedVersion: 1, patch: { notes: 'denied' } },
    },
  })
  expect(denied.status()).toBe(403)
  const crossOrigin = await request.post('/api/notebook', {
    headers: { origin: 'https://untrusted.example' },
    data: {},
  })
  expect(crossOrigin.status()).toBe(403)
})
