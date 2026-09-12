import { handleFileUpload } from '@/lib/api/file'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  context: { params: Promise<{ facilitySlug: string }> },
) {
  return handleFileUpload(request, (await context.params).facilitySlug)
}
