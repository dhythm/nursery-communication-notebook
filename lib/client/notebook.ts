import { queryOptions, type QueryClient } from '@tanstack/react-query'
import type { NotebookCommand, NotebookSnapshot } from '@/lib/types'
import { facilityApiPath } from '@/lib/facility-path'

export interface NotebookQueryScope {
  userId: string
  facilityId: string
  facilitySlug: string
  role: 'parent' | 'teacher'
}

const notebookPageSize = 200
const paginatedCollections = [
  'notebookEntries',
  'notices',
  'messages',
  'sharedFiles',
  'calendarEvents',
  'auditEvents',
] as const satisfies readonly (keyof NotebookSnapshot)[]

function mergeUniqueById<T extends { id: string }>(first: T[], second: T[]) {
  const seen = new Set(first.map((item) => item.id))
  return [...first, ...second.filter((item) => !seen.has(item.id))]
}

function mergeNotebookPages(first: NotebookSnapshot, next: NotebookSnapshot): NotebookSnapshot {
  return {
    ...first,
    notebookEntries: mergeUniqueById(first.notebookEntries, next.notebookEntries),
    notices: mergeUniqueById(first.notices, next.notices),
    messages: mergeUniqueById(next.messages, first.messages),
    sharedFiles: mergeUniqueById(first.sharedFiles, next.sharedFiles),
    calendarEvents: mergeUniqueById(first.calendarEvents, next.calendarEvents),
    auditEvents: mergeUniqueById(first.auditEvents, next.auditEvents),
  }
}

function paginatedRecordCount(snapshot: NotebookSnapshot) {
  return paginatedCollections.reduce((count, key) => count + (snapshot[key]?.length ?? 0), 0)
}

async function fetchNotebook(scope: NotebookQueryScope, signal: AbortSignal) {
  let page = 1
  let result: NotebookSnapshot | undefined

  while (true) {
    const query = new URLSearchParams({ page: String(page), limit: String(notebookPageSize) })
    const response = await fetch(`${facilityApiPath(scope.facilitySlug, '/notebook')}?${query}`, {
      signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('データを取得できませんでした')
    const current = (await response.json()) as NotebookSnapshot
    const previousCount = result ? paginatedRecordCount(result) : 0
    result = result ? mergeNotebookPages(result, current) : current
    const hasAnotherPage = paginatedCollections.some(
      (key) => current[key]?.length === notebookPageSize,
    )
    if (!hasAnotherPage || paginatedRecordCount(result) === previousCount) return result
    page += 1
  }
}

export function notebookQuery(scope: NotebookQueryScope) {
  return queryOptions({
    queryKey: ['notebook', scope.userId, scope.facilityId, scope.facilitySlug, scope.role],
    staleTime: 60_000,
    refetchInterval: 30_000,
    queryFn: ({ signal }): Promise<NotebookSnapshot> => fetchNotebook(scope, signal),
  })
}

export function notebookMutation(client: QueryClient, scope: NotebookQueryScope) {
  return {
    mutationFn: async (command: NotebookCommand): Promise<void> => {
      const response = await fetch(facilityApiPath(scope.facilitySlug, '/notebook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? '保存できませんでした。もう一度お試しください。')
      }
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: notebookQuery(scope).queryKey })
    },
  }
}
