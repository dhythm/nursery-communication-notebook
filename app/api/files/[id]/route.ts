import { getCurrentUser } from '@/lib/auth/server'
import { getDatabase } from '@/lib/db'
import { getSharedFile } from '@/lib/file-repository'
import { LocalFileStorage } from '@/lib/file-storage'
import { getRuntimeConfig } from '@/lib/runtime-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: RouteContext<'/api/files/[id]'>) {
  const user = await getCurrentUser()
  if (!user) return new Response('Not found', { status: 404 })
  const { id } = await context.params
  const metadata = await getSharedFile(await getDatabase(), user, id)
  if (!metadata) return new Response('Not found', { status: 404 })
  try {
    const bytes = await new LocalFileStorage(getRuntimeConfig().fileStorageDir).get(
      metadata.storage_key,
    )
    const encodedName = encodeURIComponent(metadata.original_name)
      .replace(/[']/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
    const inline =
      new URL(request.url).searchParams.get('inline') === '1' &&
      metadata.content_type.startsWith('image/')
    return new Response(bytes, {
      headers: {
        'Content-Type': metadata.content_type,
        'Content-Length': String(metadata.byte_size),
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="download"; filename*=UTF-8''${encodedName}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
