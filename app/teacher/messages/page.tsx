'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { ChatThread } from '@/components/chat-thread'
import { ChildAvatar } from '@/components/ui/child-avatar'
import { formatTime } from '@/lib/format'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export default function TeacherMessages() {
  const { currentUser, children, messages } = useStore()
  const myChildren = useMemo(
    () => children.filter((c) => c.facilityId === currentUser?.facilityId),
    [children, currentUser],
  )
  const [selectedId, setSelectedId] = useState(myChildren[0]?.id ?? '')
  const [mobileChat, setMobileChat] = useState(false)

  const selected = myChildren.find((c) => c.id === selectedId) ?? myChildren[0]

  function lastMessage(childId: string) {
    return [...messages]
      .filter((m) => m.childId === childId)
      .sort((a, b) => b.time.localeCompare(a.time))[0]
  }

  if (!selected || !currentUser) return null

  return (
    <div className="flex h-full">
      <aside
        className={cn(
          'w-full shrink-0 flex-col border-r border-border bg-card md:flex md:w-80',
          mobileChat ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="border-b border-border p-4">
          <h1 className="font-display text-xl font-bold">メッセージ</h1>
          <p className="text-sm text-muted-foreground">保護者とのやり取り</p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {myChildren.map((child) => {
            const last = lastMessage(child.id)
            const active = selected.id === child.id
            return (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(child.id)
                    setMobileChat(true)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors',
                    active ? 'bg-secondary' : 'hover:bg-muted',
                  )}
                >
                  <ChildAvatar name={child.name} color={child.avatarColor} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold">
                        {child.name.split(' ')[1] ?? child.name} さん
                      </p>
                      {last && (
                        <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                          {formatTime(last.time)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {last ? `${last.sender === 'parent' ? '' : 'あなた: '}${last.text}` : 'メッセージなし'}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <section
        className={cn(
          'min-w-0 flex-1 flex-col bg-muted/40 md:flex',
          mobileChat ? 'flex' : 'hidden md:flex',
        )}
      >
        <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileChat(false)}
            aria-label="一覧に戻る"
            className="rounded-full p-1.5 hover:bg-muted md:hidden"
          >
            <ChevronLeft className="size-5" />
          </button>
          <ChildAvatar name={selected.name} color={selected.avatarColor} size={38} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {selected.name} さんの保護者
            </p>
            <p className="truncate text-xs text-muted-foreground">{selected.className}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <ChatThread childId={selected.id} role="teacher" senderName={currentUser.name} />
        </div>
      </section>
    </div>
  )
}
