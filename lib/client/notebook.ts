import { queryOptions, type QueryClient } from '@tanstack/react-query'
import type { NotebookCommand, NotebookSnapshot } from '@/lib/types'

export interface NotebookQueryScope {
  userId: string
  facilityId: string
  role: 'parent' | 'teacher'
}

export function notebookQuery(scope: NotebookQueryScope) {
  return queryOptions({
    queryKey: ['notebook', scope.userId, scope.facilityId, scope.role],
    staleTime: 60_000,
    refetchInterval: 30_000,
    queryFn: async ({ signal }): Promise<NotebookSnapshot> => {
      const response = await fetch('/api/notebook', { signal, cache: 'no-store' })
      if (!response.ok) throw new Error('データを取得できませんでした')
      return response.json()
    },
  })
}

export function notebookMutation(client: QueryClient, scope: NotebookQueryScope) {
  return {
    mutationFn: async (command: NotebookCommand): Promise<void> => {
      const response = await fetch('/api/notebook', {
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
