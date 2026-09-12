import { getIdentity } from '@/lib/auth/server'
import { checkDatabase, getDatabase } from '@/lib/db'
import { getRuntimeConfig } from '@/lib/runtime-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await getIdentity())) return Response.json({ ok: false }, { status: 401 })
  try {
    return Response.json(
      {
        ok: true,
        provider: getRuntimeConfig().databaseProvider,
        ...(await checkDatabase(await getDatabase())),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
