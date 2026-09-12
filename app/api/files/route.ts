import { getCurrentUser } from '@/lib/auth/server'
import { getDatabase } from '@/lib/db'
import { LocalFileStorage } from '@/lib/file-storage'
import { uploadSharedFile } from '@/lib/file-repository'
import { getRuntimeConfig } from '@/lib/runtime-config'
import { logError } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin')
  const expectedOrigin = `${requestUrl.protocol}//${request.headers.get('host') ?? requestUrl.host}`
  if (origin && origin !== expectedOrigin)
    return Response.json({ error: 'Forbidden' }, { status: 403, headers })
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 11 * 1024 * 1024)
    return Response.json({ error: 'ファイルは10MB以下にしてください。' }, { status: 413, headers })
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File))
      return Response.json({ error: 'ファイルを選択してください。' }, { status: 400, headers })
    const id = await uploadSharedFile(
      await getDatabase(),
      new LocalFileStorage(getRuntimeConfig().fileStorageDir),
      user,
      {
        fileName: file.name,
        displayName: String(form.get('displayName') ?? file.name),
        bytes: new Uint8Array(await file.arrayBuffer()),
        commandId: String(form.get('commandId') ?? ''),
        targetClassId: String(form.get('targetClassId') ?? '') || undefined,
        targetChildId: String(form.get('targetChildId') ?? '') || undefined,
        purpose: form.get('purpose') === 'notebook' ? 'notebook' : 'shared',
      },
    )
    return Response.json({ id }, { headers })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status =
      message === 'Forbidden'
        ? 403
        : message === 'FileTooLarge'
          ? 413
          : ['InvalidFileName', 'InvalidCommand'].includes(message)
            ? 400
            : ['UnsupportedFile', 'EmptyFile'].includes(message)
              ? 415
              : 503
    if (status === 503)
      logError('file_upload_failed', error, { userId: user.id, facilityId: user.facilityId })
    return Response.json(
      {
        error:
          status === 400
            ? 'ファイル名を確認して、もう一度選択してください。'
            : status === 415
              ? 'PDF、JPEG、PNG、WebP、DOCXのみ共有できます。'
              : status === 413
                ? 'ファイルは10MB以下にしてください。'
                : status === 403
                  ? 'Forbidden'
                  : 'アップロードできませんでした。',
      },
      { status, headers },
    )
  }
}
