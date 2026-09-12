'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { formatTime } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Role } from '@/lib/types'
import { cn } from '@/lib/utils'

export function ChatThread({ childId, role }: { childId: string; role: Role }) {
  const { currentUser, messages, addMessage } = useStore()
  const [text, setText] = useState('')
  const composingRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)

  const thread = useMemo(
    () =>
      messages.filter((m) => m.childId === childId).sort((a, b) => a.time.localeCompare(b.time)),
    [messages, childId],
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length])

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const value = text.trim()
      if (!value) return
      await addMessage({
        childId,
        text: value,
      })
      setText('')
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存できませんでした')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {thread.map((m) => {
          const mine = m.senderId ? m.senderId === currentUser?.id : m.sender === role
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[78%]', mine ? 'items-end' : 'items-start')}>
                {!mine && (
                  <p className="mb-0.5 ml-1 text-xs font-semibold text-muted-foreground">
                    {m.senderName}
                  </p>
                )}
                <div
                  className={cn(
                    'rounded-3xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
                    mine
                      ? 'rounded-br-md bg-primary text-primary-foreground'
                      : 'rounded-bl-md bg-card text-card-foreground',
                  )}
                >
                  {m.text}
                </div>
                <p
                  className={cn(
                    'mt-0.5 text-[0.65rem] text-muted-foreground',
                    mine ? 'text-right' : 'ml-1',
                  )}
                >
                  {formatTime(m.time)}
                </p>
              </div>
            </div>
          )
        })}
        {thread.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            まだメッセージはありません
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border bg-card p-3">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onCompositionStart={() => (composingRef.current = true)}
            onCompositionEnd={() => (composingRef.current = false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !composingRef.current && e.keyCode !== 229) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder="メッセージを入力"
            className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <button
            type="button"
            onClick={send}
            disabled={isSaving || !text.trim()}
            aria-label="送信"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <Send className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
