'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Bell,
  CalendarDays,
  ChevronRight,
  NotebookPen,
  PencilLine,
  Thermometer,
} from 'lucide-react'
import { EntryDialog } from '@/components/parent/entry-dialog'
import { NotebookEntryCard } from '@/components/notebook-entry-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChildAvatar } from '@/components/ui/child-avatar'
import {
  ageFromBirthday,
  calendarDateParts,
  eventColor,
  formatDate,
  formatShortDate,
  moodConfig,
  todayInTimeZone,
} from '@/lib/format'
import { useParent } from '@/lib/parent-context'
import { useFacilityPath } from '@/lib/facility-path-client'
import { useStore } from '@/lib/store'
import type { Child, NotebookEntry } from '@/lib/types'

export default function ParentHome() {
  const {
    currentUser,
    notebookEntries,
    notices,
    calendarEvents,
    notifications,
    markNotificationRead,
  } = useStore()
  const { selectedChild } = useParent()
  const facilityPath = useFacilityPath()
  const [entryEditor, setEntryEditor] = useState<{ child: Child; entry?: NotebookEntry } | null>(
    null,
  )
  const today = todayInTimeZone()

  if (!selectedChild) return null

  const todayEntries = notebookEntries.filter(
    (e) => e.childId === selectedChild.id && e.date === today,
  )
  const teacherToday = todayEntries.find((e) => e.author === 'teacher')
  const myToday = todayEntries.find((e) => e.authorId === currentUser?.id)
  const latestEntry = notebookEntries.find((e) => e.childId === selectedChild.id)
  const upcoming = [...calendarEvents]
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
  const topNotices = notices.slice(0, 2)
  const familyName = currentUser?.name.split(' ')[0] ?? ''

  return (
    <div className="space-y-6 p-4">
      <div className="pt-1">
        <p className="text-sm text-muted-foreground">{formatDate(today)}</p>
        <h1 className="font-display text-xl font-bold">こんにちは、{familyName}さん</h1>
      </div>

      <section
        className="overflow-hidden rounded-3xl p-4 text-white shadow-sm"
        style={{ backgroundColor: selectedChild.avatarColor }}
      >
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/25 p-0.5">
            <ChildAvatar name={selectedChild.name} color="rgba(255,255,255,0.35)" size={52} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">{selectedChild.name}</p>
            <p className="text-sm text-white/85">
              {selectedChild.className}・{ageFromBirthday(selectedChild.birthday)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/20 px-3 py-2.5 text-sm">
          {teacherToday ? (
            <>
              <span className="font-bold">
                {moodConfig[teacherToday.mood].emoji} きょうは
                {moodConfig[teacherToday.mood].label}
              </span>
              <span className="ml-auto flex items-center gap-1">
                <Thermometer className="size-4" />
                {teacherToday.temperature}℃
              </span>
            </>
          ) : (
            <span className="text-white/90">園からの記録はまだ届いていません</span>
          )}
        </div>
      </section>

      <Button
        onClick={() => setEntryEditor({ child: selectedChild, entry: myToday })}
        className="h-14 w-full rounded-3xl text-base font-bold shadow-sm"
      >
        <PencilLine className="size-5" />
        子どもの様子を登録する
      </Button>

      <section className="space-y-3">
        <SectionHeader
          icon={<NotebookPen className="size-4" />}
          title="今日の連絡帳"
          href={facilityPath('/parent/notebook')}
        />
        {todayEntries.length > 0 ? (
          todayEntries.map((entry) => <NotebookEntryCard key={entry.id} entry={entry} />)
        ) : latestEntry ? (
          <NotebookEntryCard entry={latestEntry} showDate />
        ) : (
          <EmptyCard text="まだ連絡帳の記録がありません" />
        )}
      </section>

      {notifications.length > 0 && (
        <section className="space-y-3">
          <SectionHeader icon={<Bell className="size-4" />} title="通知" />
          <div className="space-y-2">
            {notifications.slice(0, 3).map((notification) => (
              <button
                key={notification.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left"
                onClick={() => !notification.readAt && void markNotificationRead(notification.id)}
              >
                <span
                  className={`size-2 rounded-full ${notification.readAt ? 'bg-muted' : 'bg-primary'}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {notification.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {notification.readAt ? '既読' : '新着'}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeader
          icon={<CalendarDays className="size-4" />}
          title="お知らせ"
          href={facilityPath('/parent/notices')}
        />
        <div className="space-y-2">
          {topNotices.map((notice) => (
            <Link
              key={notice.id}
              href={facilityPath('/parent/notices')}
              className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <Badge>{notice.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatShortDate(notice.date)}
                  </span>
                </div>
                <p className="truncate text-sm font-bold">{notice.title}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{notice.body}</p>
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader icon={<CalendarDays className="size-4" />} title="近日の予定" />
        <div className="rounded-3xl border border-border bg-card p-2 shadow-sm">
          {upcoming.map((event) => (
            <div key={event.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
              <div
                className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl text-white"
                style={{ backgroundColor: eventColor[event.type] }}
              >
                <span className="text-[0.6rem] font-semibold leading-none">
                  {calendarDateParts(event.date).month}月
                </span>
                <span className="text-base font-bold leading-tight">
                  {calendarDateParts(event.date).day}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {event.time ? `${event.time}〜` : '終日'}
                  {event.memo ? `・${event.memo}` : ''}
                </p>
              </div>
              <Badge className="shrink-0">{event.type}</Badge>
            </div>
          ))}
        </div>
      </section>

      {entryEditor && (
        <EntryDialog
          key={entryEditor.entry?.id ?? entryEditor.child.id}
          open
          onClose={() => setEntryEditor(null)}
          child={entryEditor.child}
          entry={entryEditor.entry}
        />
      )}
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  href,
}: {
  icon: React.ReactNode
  title: string
  href?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-1.5 font-display text-base font-bold">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      {href && (
        <Link href={href} className="flex items-center text-xs font-semibold text-primary">
          すべて見る
          <ChevronRight className="size-3.5" />
        </Link>
      )}
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}
