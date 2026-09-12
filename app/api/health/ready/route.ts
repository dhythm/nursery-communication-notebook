import { checkDatabase, getDatabase } from '@/lib/db'
import { logError } from '@/lib/logger'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    await checkDatabase(await getDatabase())
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logError('readiness_failed', error)
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
