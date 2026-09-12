import { expect, test } from '@playwright/test'

test('a parent can sign in and submit a notebook entry', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保護者としてログイン', exact: true }).click()

  await expect(page).toHaveURL('/parent')
  await expect(page.getByRole('heading', { name: 'こんにちは、田中さん' })).toBeVisible()
  await page.getByRole('button', { name: '子どもの様子を登録する' }).click()

  const dialog = page.getByRole('dialog', { name: 'ひなた の様子を登録' })
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
  expect(await response.json()).toMatchObject({ ok: true, provider: 'pglite', migrationVersion: 2 })
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

test('the API rejects teacher-only updates and cross-origin requests', async ({ request }) => {
  const denied = await request.post('/api/notebook', {
    data: { type: 'updateChild', payload: { id: 'c1', patch: { notes: 'denied' } } },
  })
  expect(denied.status()).toBe(403)
  const crossOrigin = await request.post('/api/notebook', {
    headers: { origin: 'https://untrusted.example' },
    data: {},
  })
  expect(crossOrigin.status()).toBe(403)
})
