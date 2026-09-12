import { handleFileDownload } from '@/lib/api/file'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ facilitySlug: string; id: string }> },
) {
  const { facilitySlug, id } = await context.params
  return handleFileDownload(request, facilitySlug, id)
}
