import { handleNotebookGet, handleNotebookPost } from '@/lib/api/notebook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ facilitySlug: string }> },
) {
  return handleNotebookGet(request, (await context.params).facilitySlug)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ facilitySlug: string }> },
) {
  return handleNotebookPost(request, (await context.params).facilitySlug)
}
