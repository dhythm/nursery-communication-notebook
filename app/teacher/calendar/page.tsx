'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react'
import { PageTitle } from '@/components/teacher/page-title'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { calendarDateParts, eventColor, formatDate, todayInTimeZone } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { CalendarEvent, EventType } from '@/lib/types'
import { cn } from '@/lib/utils'

const weekdays = ['日', '月', '火', '水', '木', '金', '土']
const eventTypes: EventType[] = ['行事', '面談', '健診', '休園', '持ち物']

function toKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function TeacherCalendar() {
  const { currentUser, calendarEvents, addEvent } = useStore()
  const [today] = useState(() => todayInTimeZone())
  const [view, setView] = useState(() => {
    const { year, month } = calendarDateParts(today)
    return { year, month: month - 1 }
  })
  const [selectedDate, setSelectedDate] = useState(today)
  const [addingDate, setAddingDate] = useState<string | null>(null)

  const events = useMemo(
    () => calendarEvents.filter((e) => e.facilityId === currentUser?.facilityId),
    [calendarEvents, currentUser],
  )

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return map
  }, [events])

  const firstWeekday = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedEvents = (eventsByDate.get(selectedDate) ?? []).sort((a, b) =>
    (a.time ?? '').localeCompare(b.time ?? ''),
  )

  function changeMonth(delta: number) {
    setView((v) => {
      const m = v.month + delta
      if (m < 0) return { year: v.year - 1, month: 11 }
      if (m > 11) return { year: v.year + 1, month: 0 }
      return { year: v.year, month: m }
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageTitle
        title="カレンダー"
        subtitle="行事や面談などの予定を管理します"
        action={
          <Button
            className="h-10 rounded-2xl font-bold"
            onClick={() => setAddingDate(selectedDate)}
          >
            <Plus className="size-4" />
            予定を追加
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">
              {view.year}年 {view.month + 1}月
            </h2>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="前の月"
                onClick={() => changeMonth(-1)}
                className="rounded-full p-2 hover:bg-muted"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="次の月"
                onClick={() => changeMonth(1)}
                className="rounded-full p-2 hover:bg-muted"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekdays.map((w, i) => (
              <div
                key={w}
                className={cn(
                  'py-1 text-center text-xs font-bold',
                  i === 0 && 'text-destructive',
                  i === 6 && 'text-chart-4',
                  i > 0 && i < 6 && 'text-muted-foreground',
                )}
              >
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />
              const key = toKey(view.year, view.month, day)
              const dayEvents = eventsByDate.get(key) ?? []
              const isToday = key === today
              const isSelected = key === selectedDate
              const weekday = i % 7
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className={cn(
                    'flex min-h-16 flex-col gap-1 rounded-2xl border p-1.5 text-left transition-colors md:min-h-20',
                    isSelected
                      ? 'border-primary bg-secondary'
                      : 'border-transparent hover:bg-muted/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs font-bold',
                      isToday && 'bg-primary text-primary-foreground',
                      !isToday && weekday === 0 && 'text-destructive',
                      !isToday && weekday === 6 && 'text-chart-4',
                    )}
                  >
                    {day}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 2).map((e) => (
                      <span
                        key={e.id}
                        className="truncate rounded-md px-1 py-0.5 text-[0.6rem] font-semibold text-white"
                        style={{ backgroundColor: eventColor[e.type] }}
                      >
                        {e.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="px-1 text-[0.6rem] text-muted-foreground">
                        他{dayEvents.length - 2}件
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="h-fit p-5">
          <h3 className="font-display text-base font-bold">{formatDate(selectedDate)}</h3>
          <div className="mt-3 space-y-2">
            {selectedEvents.length > 0 ? (
              selectedEvents.map((e) => (
                <div key={e.id} className="rounded-2xl bg-muted/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">{e.title}</p>
                    <Badge className="text-white" style={{ backgroundColor: eventColor[e.type] }}>
                      {e.type}
                    </Badge>
                  </div>
                  {e.time && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5" />
                      {e.time}〜
                    </p>
                  )}
                  {e.memo && <p className="mt-1 text-xs text-muted-foreground">{e.memo}</p>}
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">予定はありません</p>
            )}
          </div>
          <Button
            variant="outline"
            className="mt-4 h-10 w-full rounded-2xl font-bold"
            onClick={() => setAddingDate(selectedDate)}
          >
            <Plus className="size-4" />
            この日に予定を追加
          </Button>
        </Card>
      </div>

      {addingDate && (
        <AddEventModal
          open
          onClose={() => setAddingDate(null)}
          defaultDate={addingDate}
          onAdd={(e) => addEvent({ ...e, facilityId: currentUser?.facilityId ?? 'f1' })}
        />
      )}
    </div>
  )
}

function AddEventModal({
  open,
  onClose,
  defaultDate,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  defaultDate: string
  onAdd: (e: Omit<CalendarEvent, 'id' | 'facilityId'>) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<EventType>('行事')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('')
  const [memo, setMemo] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      await onAdd({
        title: title.trim() || '新しい予定',
        type,
        date: date || defaultDate,
        time: time || undefined,
        memo: memo || undefined,
      })
      setTitle('')
      setType('行事')
      setTime('')
      setMemo('')
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存できませんでした')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="予定を追加"
      description="カレンダーに新しい予定を登録します"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            className="h-11 flex-[2] rounded-2xl font-bold"
            onClick={submit}
            disabled={isSaving}
          >
            予定を追加
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">予定名</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例）保育参観"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-semibold">種類</span>
          <div className="flex flex-wrap gap-2">
            {eventTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                  type === t
                    ? 'border-transparent text-white'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted',
                )}
                style={type === t ? { backgroundColor: eventColor[t] } : undefined}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">日付</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">時刻（任意）</span>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">メモ（任意）</span>
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="min-h-16" />
        </label>
      </div>
    </Modal>
  )
}
