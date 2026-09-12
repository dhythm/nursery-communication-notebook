'use client'

import { ChatThread } from '@/components/chat-thread'
import { ChildAvatar } from '@/components/ui/child-avatar'
import { useParent } from '@/lib/parent-context'
import { useStore } from '@/lib/store'

export default function ParentMessages() {
  const { currentUser } = useStore()
  const { selectedChild } = useParent()

  if (!selectedChild || !currentUser) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <ChildAvatar name={selectedChild.name} color={selectedChild.avatarColor} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{selectedChild.className}の先生</p>
          <p className="truncate text-xs text-muted-foreground">
            {selectedChild.name.split(' ')[1] ?? selectedChild.name} さんについて
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-muted/40">
        <ChatThread childId={selectedChild.id} role="parent" />
      </div>
    </div>
  )
}
