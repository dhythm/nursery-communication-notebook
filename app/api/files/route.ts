export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  return Response.json({ error: 'Not found' }, { status: 404 })
}
