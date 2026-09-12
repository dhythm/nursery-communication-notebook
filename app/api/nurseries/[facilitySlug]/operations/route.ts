import { handleOperationsGet, handleOperationsPost } from '@/lib/api/operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ facilitySlug: string }> },
) {
  return handleOperationsGet(request, (await context.params).facilitySlug)
}
export async function POST(
  request: Request,
  context: { params: Promise<{ facilitySlug: string }> },
) {
  return handleOperationsPost(request, (await context.params).facilitySlug)
}
