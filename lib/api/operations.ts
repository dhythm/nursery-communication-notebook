import { ZodError } from 'zod'
import { getCurrentUser, getFacilityUser } from '@/lib/auth/server'
import { getDatabase } from '@/lib/db'
import { logError } from '@/lib/logger'
import { mutateOperations, operationModuleSchema, readOperations } from '@/lib/operations/service'

const headers = { 'Cache-Control': 'private, no-store' }
const response = (error: string, status: number) => Response.json({ error }, { status, headers })

async function handle(request: Request, facilitySlug: string, write: boolean) {
  try {
    if (!(await getCurrentUser())) return response('ログインしてください。', 401)
    const user = await getFacilityUser(facilitySlug)
    if (!user) return response('施設が見つかりません。', 404)
    if (user.role !== 'teacher') return response('職員のみ利用できます。', 403)
    const url = new URL(request.url)
    const operationModule = operationModuleSchema.parse(url.searchParams.get('module'))
    if (write) {
      const origin = request.headers.get('origin')
      const expectedOrigin = `${url.protocol}//${request.headers.get('host') ?? url.host}`
      if (origin && origin !== expectedOrigin) return response('操作が許可されていません。', 403)
      if (!request.headers.get('content-type')?.includes('application/json'))
        return response('JSON required', 415)
      const body = await request.text()
      if (body.length > 100_000) return response('入力が長すぎます。', 413)
      await mutateOperations(await getDatabase(), user, operationModule, JSON.parse(body))
      return Response.json({ ok: true }, { headers })
    }
    return Response.json(await readOperations(await getDatabase(), user, operationModule), {
      headers,
    })
  } catch (error) {
    if (
      error instanceof ZodError ||
      error instanceof SyntaxError ||
      (error instanceof Error &&
        ['InvalidInput', 'InvalidDate', 'InvalidClass'].includes(error.message))
    )
      return response('入力内容を確認してください。', 400)
    if (error instanceof Error && error.message === 'Forbidden')
      return response('操作が許可されていません。', 403)
    if (error instanceof Error && error.message === 'Conflict')
      return response('記録が更新されました。最新の内容を確認してください。', 409)
    logError('operations_request_failed', error)
    return response('データを処理できませんでした。再試行してください。', 503)
  }
}
export const handleOperationsGet = (request: Request, slug: string) => handle(request, slug, false)
export const handleOperationsPost = (request: Request, slug: string) => handle(request, slug, true)
