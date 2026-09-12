'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useStore } from './store'
import type { Child } from './types'

interface ParentContextValue {
  myChildren: Child[]
  selectedChild: Child | null
  selectedChildId: string
  setSelectedChildId: (id: string) => void
}

const ParentContext = createContext<ParentContextValue | null>(null)

export function ParentProvider({ children }: { children: ReactNode }) {
  const { currentUser, children: allChildren } = useStore()
  const myChildren = useMemo(
    () => allChildren.filter((c) => currentUser?.childIds?.includes(c.id)),
    [allChildren, currentUser],
  )
  const [selectedChildId, setSelectedChildId] = useState(myChildren[0]?.id ?? '')

  const value = useMemo<ParentContextValue>(() => {
    const id = myChildren.some((c) => c.id === selectedChildId)
      ? selectedChildId
      : (myChildren[0]?.id ?? '')
    return {
      myChildren,
      selectedChildId: id,
      selectedChild: myChildren.find((c) => c.id === id) ?? null,
      setSelectedChildId,
    }
  }, [myChildren, selectedChildId])

  return <ParentContext.Provider value={value}>{children}</ParentContext.Provider>
}

export function useParent() {
  const ctx = useContext(ParentContext)
  if (!ctx) throw new Error('useParent must be used within ParentProvider')
  return ctx
}
