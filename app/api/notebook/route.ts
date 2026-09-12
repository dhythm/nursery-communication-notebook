export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  return Response.json({ error: 'Not found' }, { status: 404, headers })
}

export async function POST() {
  return Response.json({ error: 'Not found' }, { status: 404, headers })
}
