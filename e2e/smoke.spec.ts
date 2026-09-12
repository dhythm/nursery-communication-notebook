import { expect, test } from '@playwright/test'

const parentPath = '/nurseries/nijiiro/parent'
const teacherPath = '/nurseries/nijiiro/teacher'

test('a parent can edit and submit a notebook entry', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()

  await expect(page).toHaveURL(parentPath)
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
  await page.getByRole('button', { name: '子どもの様子を登録する' }).click()

  const dialog = page.getByRole('dialog', { name: 'ひなた の様子を編集' })
  const note = `今日は自分で靴を履けました。${Date.now()}`
  await dialog.getByLabel('夕食内容').fill('ご飯、焼き魚、みそ汁')
  await dialog.getByLabel('就寝時間').fill('21:00')
  await dialog.getByLabel('昨晩の排便の状態').selectOption('normal')
  await dialog.getByLabel('起床時間').fill('06:30')
  await dialog.getByLabel('検温時刻').fill('07:00')
  await dialog.getByLabel('今朝の排便の状態').selectOption('none')
  await dialog.getByLabel('朝食内容').fill('トースト、バナナ、牛乳')
  await dialog.getByLabel('子どもの様子').fill('元気に過ごしています')
  await dialog.getByLabel('お迎えに来る方').selectOption('mother')
  await dialog.getByLabel('お迎え予定時刻').fill('17:30')
  await dialog.getByLabel('連絡事項').fill(note)
  await expect(dialog.getByLabel('朝食の量')).toHaveCount(0)
  await expect(dialog.getByLabel('写真')).toHaveCount(0)

  const [dialogBox, bedtimeBox, temperatureBox, measuredAtBox, pickupPersonBox, pickupTimeBox] =
    await Promise.all([
      dialog.boundingBox(),
      dialog.getByLabel('就寝時間').boundingBox(),
      dialog.getByLabel('体温').boundingBox(),
      dialog.getByLabel('検温時刻').boundingBox(),
      dialog.getByLabel('お迎えに来る方').boundingBox(),
      dialog.getByLabel('お迎え予定時刻').boundingBox(),
    ])
  expect(bedtimeBox!.width).toBeLessThan(dialogBox!.width * 0.6)
  expect(Math.abs(temperatureBox!.y - measuredAtBox!.y)).toBeLessThan(5)
  expect(Math.abs(pickupPersonBox!.y - pickupTimeBox!.y)).toBeLessThan(5)
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/notebook') && response.request().method() === 'POST',
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

  await expect(page).toHaveURL(teacherPath)
  await expect(page.getByRole('heading', { name: 'ダッシュボード', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '園児管理へ', exact: true }).click()
  await expect(page).toHaveURL(`${teacherPath}/children`)
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
  await expect(page).toHaveURL(teacherPath)
  await page.goto(`${teacherPath}/children`)

  await page.getByRole('button', { name: /田中 あおい/ }).click()
  await page.getByRole('button', { name: '編集', exact: true }).click()
  const childDialog = page.getByRole('dialog', { name: '園児情報を編集' })
  await expect(childDialog.getByLabel('アレルギー（読点や空白で区切り）')).toHaveValue('')
  await expect(childDialog.getByLabel('申し送り・メモ')).toHaveValue(
    '人見知りが少しあります。だっこが好きです。',
  )
  await childDialog.getByRole('button', { name: 'キャンセル' }).click()

  await page.goto(`${teacherPath}/calendar`)
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
  await page.goto(`${teacherPath}/children`)

  await expect(page).toHaveURL(parentPath)
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
})

test('a facility slug cannot be changed to access another nursery', async ({ page, request }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()
  await expect(page).toHaveURL(parentPath)

  await page.goto('/nurseries/himawari/parent')
  await expect(page.getByText('This page could not be found.')).toBeVisible()

  const apiResponse = await request.get('/api/nurseries/himawari/notebook')
  expect(apiResponse.status()).toBe(404)
  expect((await request.get('/api/notebook')).status()).toBe(404)
})

test('the agent server uses PGlite and caches data across page navigation', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBeTruthy()
  expect(await response.json()).toMatchObject({
    ok: true,
    provider: 'pglite',
    migrationVersion: 10,
  })
  let readCount = 0
  page.on('response', (response) => {
    if (
      new URL(response.url()).pathname === '/api/nurseries/nijiiro/notebook' &&
      response.request().method() === 'GET' &&
      response.ok()
    )
      readCount += 1
  })
  await page.goto(parentPath)
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
  expect(readCount).toBe(1)
  await page.getByRole('link', { name: '連絡帳', exact: true }).click()
  await expect(page).toHaveURL(`${parentPath}/notebook`)
  await page.getByRole('link', { name: 'ホーム', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
  expect(readCount).toBe(1)
})

test('a teacher publishes an important notice and a parent confirms it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL(teacherPath)
  await page.goto(`${teacherPath}/notices`)
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
  await page.goto(`${parentPath}/notices`)
  const article = page.getByRole('article').filter({ hasText: title })
  await article.getByRole('button', { name: '詳細を確認' }).click()
  await article.getByRole('button', { name: '確認しました' }).click()
  await expect(article.getByText('確認済み')).toBeVisible()
})

test('a teacher uploads a real PDF that an authorized parent can download', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL(teacherPath)
  await page.goto(`${teacherPath}/files`)
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
  await page.goto(`${parentPath}/files`)
  const download = page.getByRole('link', { name: 'guide.pdfをダウンロード' })
  const response = await page.request.get((await download.getAttribute('href')) ?? '')
  expect(response.status()).toBe(200)
  expect(await response.body()).toEqual(Buffer.from('%PDF-1.7\nreal file'))
})

test('a teacher registers a class, guardian, and child', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL(teacherPath)
  await page.goto(`${teacherPath}/management`)
  const suffix = Date.now()
  const className = `テスト組${suffix}`
  const classCard = page.getByRole('heading', { name: 'クラスを追加' }).locator('..')
  await classCard.getByLabel('クラス名').fill(className)
  const classSaved = page.waitForResponse(
    (response) => response.url().endsWith('/notebook') && response.request().method() === 'POST',
  )
  await classCard.getByRole('button', { name: '追加' }).click()
  expect((await classSaved).status()).toBe(200)
  const memberCard = page.getByRole('heading', { name: '利用者を追加' }).locator('..')
  await memberCard.getByLabel('氏名').fill(`テスト保護者${suffix}`)
  await memberCard.getByLabel('メールアドレス').fill(`parent-${suffix}@example.com`)
  const memberSaved = page.waitForResponse(
    (response) => response.url().endsWith('/notebook') && response.request().method() === 'POST',
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
  const denied = await request.post('/api/nurseries/nijiiro/notebook', {
    data: {
      commandId: 'denied-update',
      type: 'updateChild',
      payload: { id: 'c1', expectedVersion: 1, patch: { notes: 'denied' } },
    },
  })
  expect(denied.status()).toBe(403)
  const crossOrigin = await request.post('/api/nurseries/nijiiro/notebook', {
    headers: { origin: 'https://untrusted.example' },
    data: {},
  })
  expect(crossOrigin.status()).toBe(403)
})
