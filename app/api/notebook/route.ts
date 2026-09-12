import { ZodError } from 'zod'
import { getCurrentUser } from '@/lib/auth/server'
import { getDatabase } from '@/lib/db'
import { mutateNotebook, readNotebook } from '@/lib/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
  try {
    return Response.json(await readNotebook(await getDatabase(), user), { headers })
  } catch {
    return Response.json({ error: 'データを取得できませんでした。' }, { status: 503, headers })
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
  // Cookies identify the development role; reject cross-origin mutations as well.
  const origin = request.headers.get('origin')
  const requestUrl = new URL(request.url)
  const expectedOrigin = `${requestUrl.protocol}//${request.headers.get('host') ?? requestUrl.host}`
  if (origin && origin !== expectedOrigin) {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers })
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return Response.json({ error: 'JSON required' }, { status: 415, headers })
  }
  try {
    const body = await request.text()
    if (body.length > 100_000)
      return Response.json({ error: 'Request too large' }, { status: 413, headers })
    await mutateNotebook(await getDatabase(), user, JSON.parse(body))
    return Response.json({ ok: true }, { headers })
  } catch (error) {
    const status =
      error instanceof ZodError || error instanceof SyntaxError
        ? 400
        : error instanceof Error && error.message === 'Forbidden'
          ? 403
          : error instanceof Error && error.message === 'Conflict'
            ? 409
            : 503
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
