import { getCurrentUser, getFacilityUser } from '@/lib/auth/server'
import { getDatabase } from '@/lib/db'
import { createFileStorage } from '@/lib/file-storage'
import { deleteSharedFile, getSharedFile, uploadSharedFile } from '@/lib/file-repository'
import { logError } from '@/lib/logger'
import { getRuntimeConfig } from '@/lib/runtime-config'

const headers = { 'Cache-Control': 'private, no-store' }

export async function handleFileUpload(request: Request, facilitySlug: string) {
  if (!(await getCurrentUser()))
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
  const user = await getFacilityUser(facilitySlug)
  if (!user) return Response.json({ error: 'Not found' }, { status: 404, headers })
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
      createFileStorage(getRuntimeConfig()),
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

export async function handleFileDownload(request: Request, facilitySlug: string, id: string) {
  if (!(await getCurrentUser())) return new Response('Not found', { status: 404 })
  const user = await getFacilityUser(facilitySlug)
  if (!user) return new Response('Not found', { status: 404 })
  const metadata = await getSharedFile(await getDatabase(), user, id)
  if (!metadata) return new Response('Not found', { status: 404 })
  try {
    const bytes = await createFileStorage(getRuntimeConfig()).get(metadata.storage_key)
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

export async function handleFileDelete(request: Request, facilitySlug: string, id: string) {
  if (!(await getCurrentUser()))
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
  const user = await getFacilityUser(facilitySlug)
  if (!user) return Response.json({ error: 'Not found' }, { status: 404, headers })
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin')
  const expectedOrigin = `${requestUrl.protocol}//${request.headers.get('host') ?? requestUrl.host}`
  if (origin && origin !== expectedOrigin)
    return Response.json({ error: 'Forbidden' }, { status: 403, headers })
  if (!request.headers.get('content-type')?.includes('application/json'))
    return Response.json({ error: 'JSON required' }, { status: 415, headers })

  try {
    const body = await request.text()
    if (body.length > 1_000)
      return Response.json({ error: 'Request too large' }, { status: 413, headers })
    const commandId = String((JSON.parse(body) as { commandId?: unknown }).commandId ?? '')
    await deleteSharedFile(
      await getDatabase(),
      createFileStorage(getRuntimeConfig()),
      user,
      id,
      commandId,
    )
    return Response.json({ ok: true }, { headers })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status =
      error instanceof SyntaxError || message === 'InvalidCommand'
        ? 400
        : message === 'Forbidden'
          ? 403
          : 503
    if (status === 503)
      logError('file_delete_failed', error, { userId: user.id, facilityId: user.facilityId })
    return Response.json(
      {
        error:
          status === 400
            ? '入力内容を確認してください。'
            : status === 403
              ? 'Forbidden'
              : '削除できませんでした。',
      },
      { status, headers },
    )
  }
}
