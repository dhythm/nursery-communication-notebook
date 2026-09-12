import { expect, test } from '@playwright/test'

const parentPath = '/nurseries/nijiiro/parent'
const teacherPath = '/nurseries/nijiiro/teacher'

test('the shared demo notice stays visible for parents and teachers', async ({ page }, testInfo) => {
  const demoNotice = page.getByRole('complementary', { name: 'デモ環境のお知らせ' })

  await page.goto('/')
  await expect(demoNotice).toContainText('共用デモ環境')
  await expect(demoNotice).toContainText('実在する個人情報を入力しないでください')
  await expect(page.getByText('このアプリを使いたい方へ')).toBeVisible()
  await expect(page.getByRole('link', { name: /GitHub/ })).toHaveAttribute(
    'href',
    'https://github.com/dhythm/nursery-communication-notebook',
  )
  await expect(page.getByRole('link', { name: /X（@dhythm_dev）/ })).toHaveAttribute(
    'href',
    'https://x.com/dhythm_dev',
  )
  await page.screenshot({ path: testInfo.outputPath('demo-login.png'), fullPage: true })

  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()
  await expect(page).toHaveURL(parentPath)
  await expect(demoNotice).toBeVisible()

  await page.goto(`${parentPath}/settings`)
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL(teacherPath)
  await expect(demoNotice).toBeVisible()
})

test('shows a friendly loading state while opening the notebook', async ({ page }) => {
  let releaseRequest!: () => void
  const requestBlocked = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  await page.route('**/api/nurseries/nijiiro/notebook?*', async (route) => {
    await requestBlocked
    await route.continue()
  })

  await page.goto(parentPath)
  const loading = page.getByRole('status', { name: '連絡帳をひらいています' })
  await expect(loading).toBeVisible()
  releaseRequest()
  await expect(loading).toBeHidden()
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
})

test('a parent can register and submit a notebook entry', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()

  await expect(page).toHaveURL(parentPath)
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
  await page.getByRole('button', { name: '子どもの様子を登録する' }).click()

  const dialog = page.getByRole('dialog', { name: 'ひなた の様子を登録' })
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
  expect(Math.abs(pickupPersonBox!.height - pickupTimeBox!.height)).toBeLessThan(1)
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

test('a confirmed parent notebook is locked in the parent screen', async ({ page }) => {
  await page.goto(`${parentPath}/notebook`)
  await page
    .getByRole('button', { name: /ひなた/ })
    .first()
    .click()
  await page.getByRole('button', { name: /田中 あおい/ }).click()

  const note = `園確認後ロック ${Date.now()}`
  const created = await page.request.post('/api/nurseries/nijiiro/notebook', {
    data: {
      commandId: `lock-create-${Date.now()}`,
      type: 'saveNotebookEntry',
      payload: {
        childId: 'c2',
        mood: 'normal',
        temperature: '36.7',
        meals: '朝食を食べました',
        nap: '',
        toilet: '',
        note,
        eveningMeal: 'ご飯、みそ汁',
        bedtime: '21:00',
        eveningStool: 'normal',
        eveningStoolCount: 1,
        wakeTime: '06:30',
        morningStool: 'none',
        morningStoolCount: 0,
        breakfast: 'トースト、果物',
        temperatureMeasuredAt: '07:00',
        condition: '元気です',
        pickupPerson: 'mother',
        pickupTime: '17:30',
        status: 'published',
      },
    },
  })
  expect(created.status()).toBe(200)

  await page.goto(`${parentPath}/settings`)
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ログイン', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL(teacherPath)
  await page.goto(`${teacherPath}/children`)
  await page.getByRole('button', { name: /田中 あおい/ }).click()
  const teacherEntry = page.getByRole('article').filter({ hasText: note })
  await teacherEntry.getByRole('button', { name: '連絡帳を確認済みにする' }).click()
  await expect(teacherEntry.getByText('園確認済み')).toBeVisible()

  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ログイン', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()
  await expect(page).toHaveURL(parentPath)
  await page.goto(`${parentPath}/notebook`)
  await page
    .getByRole('button', { name: /ひなた/ })
    .first()
    .click()
  await page.getByRole('button', { name: /田中 あおい/ }).click()
  const parentEntry = page.getByRole('article').filter({ hasText: note })
  await expect(parentEntry.getByText('園確認済み')).toBeVisible()
  await expect(parentEntry.getByRole('button', { name: '編集' })).toHaveCount(0)
  await expect(parentEntry.getByRole('button', { name: '送信取消' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '園で確認済みです' })).toBeDisabled()
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

test('the child list is grouped by class in age order', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL(teacherPath)
  await page.goto(`${teacherPath}/children`)

  const childNavigation = page.getByRole('navigation', { name: '園児一覧' })
  const expectedClasses = [
    ['うみ組（0歳児）', 6],
    ['ほし組（1歳児）', 8],
    ['つき組（2歳児）', 10],
    ['かぜ組（3歳児）', 12],
    ['そら組（4歳児）', 12],
    ['にじ組（5歳児）', 12],
  ] as const

  await expect(childNavigation.getByRole('heading', { level: 2 })).toHaveText(
    expectedClasses.map(([className]) => className),
  )
  for (const [className, childCount] of expectedClasses) {
    const classGroup = childNavigation.getByRole('region', { name: className })
    await expect(classGroup.getByText(`${childCount}名`, { exact: true })).toBeVisible()
    await expect(classGroup.getByRole('button')).toHaveCount(childCount)
  }
  const listDimensions = await childNavigation.evaluate((element) => ({
    clientHeight: element.parentElement?.clientHeight ?? 0,
    scrollHeight: element.parentElement?.scrollHeight ?? 0,
  }))
  expect(listDimensions.clientHeight).toBeLessThan(page.viewportSize()!.height)
  expect(listDimensions.scrollHeight).toBeGreaterThan(listDimensions.clientHeight)
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
  await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible()

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
    migrationVersion: 18,
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

test('a parent can send an absence notice from messages', async ({ page }) => {
  await page.goto(`${parentPath}/messages`)
  await page.getByRole('button', { name: '欠席連絡', exact: true }).click()
  await page.getByLabel('日付').fill('2026-09-15')
  const note = `発熱のため欠席します。${Date.now()}`
  await page.getByPlaceholder('補足があれば入力').fill(note)
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/notebook') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '送信', exact: true }).click()
  expect((await saved).status()).toBe(200)
  const message = page.locator('[data-message-kind="absence"]').filter({ hasText: note })
  await expect(message).toContainText(note)
  await page.reload()
  await expect(
    page.locator('[data-message-kind="absence"]').filter({ hasText: note }),
  ).toContainText(note)
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
  const noticeBody =
    '運動会の開催にあたり、当日の集合時刻と持ち物をご案内します。水筒、帽子、着替えをご用意ください。詳細画面だけに表示される末尾です。'
  await dialog.getByLabel('タイトル').fill(title)
  await dialog.getByLabel('本文').fill(noticeBody)
  await dialog.getByLabel('分類').selectOption('重要')
  await dialog.getByLabel('確認を必須にする').check()
  await dialog.getByRole('button', { name: '配信する' }).click()
  await expect(page.getByText(title, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()
  await page.goto(`${parentPath}/notices`)
  const article = page.getByRole('article').filter({ hasText: title })
  await expect(article).not.toContainText('詳細画面だけに表示される末尾です。')
  await article.getByRole('button', { name: '詳細を確認' }).click()
  const noticeDialog = page.getByRole('dialog', { name: title })
  await expect(noticeDialog).toContainText(noticeBody)
  await expect(noticeDialog).toContainText('重要')
  await expect(noticeDialog).toContainText('既読')
  await noticeDialog.getByRole('button', { name: '確認しました' }).click()
  await expect(noticeDialog.getByText('確認済み')).toBeVisible()
})

test('a teacher uploads a real PDF that an authorized parent can download', async ({ page }) => {
  const fileName = `guide-${Date.now()}.pdf`
  await page.goto('/')
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL(teacherPath)
  await page.goto(`${teacherPath}/files`)
  await page.getByRole('button', { name: '資料をアップロード' }).click()
  const dialog = page.getByRole('dialog', { name: '資料をアップロード' })
  await dialog.locator('input[type=file]').setInputFiles({
    name: fileName,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nreal file'),
  })
  await dialog.getByRole('button', { name: 'アップロードして共有' }).click()
  await expect(page.getByText(fileName, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()
  await page.goto(`${parentPath}/files`)
  const download = page.getByRole('link', { name: `${fileName}をダウンロード` })
  const response = await page.request.get((await download.getAttribute('href')) ?? '')
  expect(response.status()).toBe(200)
  expect(await response.body()).toEqual(Buffer.from('%PDF-1.7\nreal file'))

  await page.goto(`${parentPath}/settings`)
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await page.getByRole('button', { name: '保育士', exact: true }).click()
  await page.getByRole('button', { name: '保育士としてログイン', exact: true }).click()
  await expect(page).toHaveURL(teacherPath)
  await page.goto(`${teacherPath}/files`)
  await page.getByRole('button', { name: `${fileName}の公開を取り消す` }).click()
  const deleteDialog = page.getByRole('dialog', { name: '資料の公開を取り消す' })
  const deleted = page.waitForResponse(
    (response) => response.request().method() === 'DELETE' && response.url().includes('/files/'),
  )
  await deleteDialog.getByRole('button', { name: '公開を取り消す' }).click()
  expect((await deleted).status()).toBe(200)
  await expect(deleteDialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: `${fileName}の公開を取り消す` })).toHaveCount(0)

  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()
  await page.goto(`${parentPath}/files`)
  await expect(page.getByRole('link', { name: `${fileName}をダウンロード` })).toHaveCount(0)
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
