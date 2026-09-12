import { ZodError } from 'zod'
import { getCurrentUser, getFacilityUser } from '@/lib/auth/server'
import { getDatabase } from '@/lib/db'
import { logError } from '@/lib/logger'
import { mutateNotebook, readNotebook } from '@/lib/repository'

const headers = { 'Cache-Control': 'private, no-store' }

export async function handleNotebookGet(request: Request, facilitySlug: string) {
  if (!(await getCurrentUser()))
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
  const user = await getFacilityUser(facilitySlug)
  if (!user) return Response.json({ error: 'Not found' }, { status: 404, headers })
  try {
    const query = new URL(request.url).searchParams
    const page = Math.max(1, Number(query.get('page') ?? 1) || 1)
    const limit = Math.max(1, Math.min(Number(query.get('limit') ?? 200) || 200, 500))
    const from = query.get('from') || undefined
    const to = query.get('to') || undefined
    if ((from && !isDate(from)) || (to && !isDate(to)))
      return Response.json({ error: '日付を確認してください。' }, { status: 400, headers })
    return Response.json(
      await readNotebook(await getDatabase(), user, {
        facilitySlug,
        from,
        to,
        search: query.get('q') || undefined,
        limit,
        offset: (page - 1) * limit,
      }),
      { headers },
    )
  } catch (error) {
    logError('notebook_read_failed', error, { userId: user.id, facilityId: user.facilityId })
    return Response.json({ error: 'データを取得できませんでした。' }, { status: 503, headers })
  }
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export async function handleNotebookPost(request: Request, facilitySlug: string) {
  if (!(await getCurrentUser()))
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
  const user = await getFacilityUser(facilitySlug)
  if (!user) return Response.json({ error: 'Not found' }, { status: 404, headers })
  const origin = request.headers.get('origin')
  const requestUrl = new URL(request.url)
  const expectedOrigin = `${requestUrl.protocol}//${request.headers.get('host') ?? requestUrl.host}`
  if (origin && origin !== expectedOrigin)
    return Response.json({ error: 'Forbidden' }, { status: 403, headers })
  if (!request.headers.get('content-type')?.includes('application/json'))
    return Response.json({ error: 'JSON required' }, { status: 415, headers })
  try {
    const body = await request.text()
    if (body.length > 100_000)
      return Response.json({ error: 'Request too large' }, { status: 413, headers })
    await mutateNotebook(await getDatabase(), user, JSON.parse(body))
    return Response.json({ ok: true }, { headers })
  } catch (error) {
    const status =
      error instanceof ZodError ||
      error instanceof SyntaxError ||
      (error instanceof Error && ['InvalidDate', 'InvalidClass'].includes(error.message))
        ? 400
        : error instanceof Error && error.message === 'Forbidden'
          ? 403
          : error instanceof Error && error.message === 'Conflict'
            ? 409
            : 503
    if (status === 503)
      logError('notebook_mutation_failed', error, { userId: user.id, facilityId: user.facilityId })
    return Response.json(
      {
        error:
          status === 400
            ? '入力内容を確認してください。'
            : status === 403
              ? 'Forbidden'
              : status === 409
                ? '他の利用者が先に更新しました。再読み込みして確認してください。'
                : '保存できませんでした。',
      },
      { status, headers },
    )
  }
}
