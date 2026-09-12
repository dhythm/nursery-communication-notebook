'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { facilityApiPath } from '@/lib/facility-path'
import { useStore } from '@/lib/store'

type OperationModule = 'risks' | 'attendance' | 'plans' | 'nap'
type Command = { type: string; payload: unknown }

export function useOperations<T>(module: OperationModule) {
  const { facilitySlug } = useParams<{ facilitySlug: string }>()
  const { currentUser } = useStore()
  const queryClient = useQueryClient()
  const url = `${facilityApiPath(facilitySlug, '/operations')}?module=${module}`
  const queryKey = ['operations', url, currentUser?.id]
  const query = useQuery<T>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(url, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? '読み込めませんでした。')
      return body as T
    },
    enabled: currentUser?.role === 'teacher',
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  const [isPending, setIsPending] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const inFlight = useRef(false)
  // Retain the same ID when retrying after a lost response.
  const retry = useRef<{ serialized: string; commandId: string } | null>(null)

  async function mutate(command: Command): Promise<boolean> {
    if (inFlight.current) return false
    inFlight.current = true
    setIsPending(true)
    setMutationError(null)
    const serialized = JSON.stringify(command)
    if (retry.current?.serialized !== serialized)
      retry.current = { serialized, commandId: crypto.randomUUID() }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...command, commandId: retry.current.commandId }),
      })
      const body = await response.json()
      if (!response.ok) {
        if (response.status < 500) retry.current = null
        if (response.status === 409) await query.refetch()
        throw new Error(body.error ?? '保存できませんでした。')
      }
      retry.current = null
      await queryClient.invalidateQueries({ queryKey })
      return true
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : '保存できませんでした。')
      return false
    } finally {
      inFlight.current = false
      setIsPending(false)
    }
  }
  return {
    data: query.data,
    error: mutationError ?? query.error?.message ?? null,
    isLoading: query.isLoading,
    isPending,
    mutate,
    refresh: () => query.refetch(),
  }
}
