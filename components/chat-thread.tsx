'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Clock3, Save, Send, Trash2 } from 'lucide-react'
import { formatDate, formatTime, todayInTimeZone } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { MessageKind, Role } from '@/lib/types'
import { cn } from '@/lib/utils'

type MessageTemplate = {
  id: string
  name: string
  text: string
  custom?: boolean
}

const defaultTeacherTemplates: MessageTemplate[] = [
  {
    id: 'daily-update',
    name: '本日の様子',
    text: '本日も元気に過ごしています。園での様子について、気になることがありましたらお知らせください。',
  },
  {
    id: 'health-check',
    name: '体調確認',
    text: '本日、少し体調が気になる様子がありました。ご家庭でも様子を見ていただき、変化がありましたらお知らせください。',
  },
  {
    id: 'belongings',
    name: '持ち物のお願い',
    text: '園で使用する持ち物についてご確認をお願いします。次回登園時にお持ちいただけますと助かります。',
  },
]

export function ChatThread({ childId, role }: { childId: string; role: Role }) {
  const { currentUser, messages, addMessage } = useStore()
  const draftKey =
    role === 'teacher' && currentUser
      ? `nursery:teacher-message-draft:${currentUser.id}:${childId}`
      : null
  const templatesKey =
    role === 'teacher' && currentUser
      ? `nursery:teacher-message-templates:${currentUser.id}`
      : null
  const [text, setText] = useState(() => readStoredText(draftKey))
  const [kind, setKind] = useState<MessageKind>('general')
  const [scheduledDate, setScheduledDate] = useState(todayInTimeZone())
  const [scheduledTime, setScheduledTime] = useState('')
  const [customTemplates, setCustomTemplates] = useState<MessageTemplate[]>(() =>
    readStoredTemplates(templatesKey),
  )
  const [templateName, setTemplateName] = useState('')
  const [showTemplateSave, setShowTemplateSave] = useState(false)
  const composingRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)

  const thread = useMemo(
    () =>
      messages.filter((m) => m.childId === childId).sort((a, b) => a.time.localeCompare(b.time)),
    [messages, childId],
  )
  const teacherTemplates = [...defaultTeacherTemplates, ...customTemplates]

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length])

  useEffect(() => {
    if (!draftKey || typeof window === 'undefined') return
    if (text) window.localStorage.setItem(draftKey, text)
    else window.localStorage.removeItem(draftKey)
  }, [draftKey, text])

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const value = text.trim() || defaultMessage(kind, scheduledDate, scheduledTime)
      if (!value) return
      await addMessage({
        childId,
        text: value,
        kind,
        scheduledDate: kind === 'general' ? undefined : scheduledDate,
        scheduledTime: kind === 'late' || kind === 'pickup' ? scheduledTime : undefined,
      })
      if (draftKey && typeof window !== 'undefined')
        window.localStorage.removeItem(draftKey)
      setText('')
      setKind('general')
      setScheduledTime('')
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存できませんでした')
    } finally {
      setIsSaving(false)
    }
  }

  function saveTemplate() {
    if (!templatesKey || typeof window === 'undefined') return
    const name = templateName.trim()
    const value = text.trim()
    if (!name || !value) return
    const template: MessageTemplate = {
      id: `custom-${Date.now()}`,
      name,
      text: value,
      custom: true,
    }
    const next = [...customTemplates, template]
    setCustomTemplates(next)
    window.localStorage.setItem(templatesKey, JSON.stringify(next))
    setTemplateName('')
    setShowTemplateSave(false)
  }

  function deleteTemplate(id: string) {
    if (!templatesKey || typeof window === 'undefined') return
    const next = customTemplates.filter((template) => template.id !== id)
    setCustomTemplates(next)
    window.localStorage.setItem(templatesKey, JSON.stringify(next))
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
                  data-message-kind={m.kind ?? 'general'}
                  className={cn(
                    'rounded-3xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
                    mine
                      ? 'rounded-br-md bg-primary text-primary-foreground'
                      : 'rounded-bl-md bg-card text-card-foreground',
                  )}
                >
                  {m.kind && m.kind !== 'general' && m.scheduledDate && (
                    <p className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-bold opacity-90">
                      <span>{messageKindLabels[m.kind]}</span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {formatDate(m.scheduledDate)}
                      </span>
                      {m.scheduledTime && (
                        <span className="flex items-center gap-1">
                          <Clock3 className="size-3" />
                          {m.scheduledTime}
                        </span>
                      )}
                    </p>
                  )}
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
        {role === 'parent' && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5" aria-label="連絡の種類">
            {messageKinds.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={kind === item.value}
                onClick={() => {
                  setKind(item.value)
                  setText('')
                  if (item.value === 'general' || item.value === 'absence') setScheduledTime('')
                }}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                  kind === item.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        {role === 'teacher' && (
          <div className="mb-2 space-y-2">
            <div
              className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
              aria-label="メッセージテンプレート"
            >
              {teacherTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex shrink-0 items-center rounded-full border bg-background"
                >
                  <button
                    type="button"
                    onClick={() => setText(template.text)}
                    className="px-3 py-1.5 text-xs font-bold"
                  >
                    {template.name}
                  </button>
                  {template.custom && (
                    <button
                      type="button"
                      aria-label={`${template.name}を削除`}
                      onClick={() => deleteTemplate(template.id)}
                      className="mr-1 rounded-full p-1 text-muted-foreground hover:bg-muted"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setShowTemplateSave((value) => !value)}
                disabled={!text.trim()}
                className="flex shrink-0 items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-xs font-bold disabled:opacity-40"
              >
                <Save className="size-3" />
                テンプレート保存
              </button>
            </div>
            {showTemplateSave && (
              <div className="flex gap-2">
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="テンプレート名"
                  aria-label="テンプレート名"
                  className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={!templateName.trim() || !text.trim()}
                  className="rounded-xl bg-secondary px-3 text-xs font-bold disabled:opacity-40"
                >
                  保存
                </button>
              </div>
            )}
          </div>
        )}
        {kind !== 'general' && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold">
              日付
              <input
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                required
              />
            </label>
            {(kind === 'late' || kind === 'pickup') && (
              <label className="text-xs font-semibold">
                予定時刻
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(event) => setScheduledTime(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                  required
                />
              </label>
            )}
          </div>
        )}
        {role === 'teacher' && text.trim() && (
          <p className="mb-1 text-right text-[0.65rem] text-muted-foreground">
            下書き保存済み
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
            placeholder={kind === 'general' ? 'メッセージを入力' : '補足があれば入力'}
            className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <button
            type="button"
            onClick={send}
            disabled={
              isSaving ||
              (kind === 'general' && !text.trim()) ||
              (kind !== 'general' && !scheduledDate) ||
              ((kind === 'late' || kind === 'pickup') && !scheduledTime)
            }
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

const messageKindLabels: Record<MessageKind, string> = {
  general: '通常',
  absence: '欠席連絡',
  late: '遅刻連絡',
  pickup: '送迎予定',
}

const messageKinds = (Object.entries(messageKindLabels) as [MessageKind, string][]).map(
  ([value, label]) => ({ value, label }),
)

function readStoredText(key: string | null) {
  if (!key || typeof window === 'undefined') return ''
  return window.localStorage.getItem(key) ?? ''
}

function readStoredTemplates(key: string | null): MessageTemplate[] {
  if (!key || typeof window === 'undefined') return []
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(saved)) return []
    return saved.filter(
      (template): template is MessageTemplate =>
        typeof template === 'object' &&
        template !== null &&
        'id' in template &&
        typeof template.id === 'string' &&
        'name' in template &&
        typeof template.name === 'string' &&
        'text' in template &&
        typeof template.text === 'string',
    )
  } catch {
    return []
  }
}

function defaultMessage(kind: MessageKind, date: string, time: string) {
  if (kind === 'absence') return `${date}は欠席します。`
  if (kind === 'late' && time) return `${date}は${time}頃に登園予定です。`
  if (kind === 'pickup' && time) return `${date}のお迎えは${time}頃の予定です。`
  return ''
}
