'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { CalendarClock, CheckCircle2, ClipboardList, MessageCircle, Users } from 'lucide-react'
import { PageTitle } from '@/components/teacher/page-title'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ChildAvatar } from '@/components/ui/child-avatar'
import { eventColor, formatDate, formatTime, moodConfig } from '@/lib/format'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const TODAY = '2026-09-12'

export default function TeacherDashboard() {
  const { currentUser, children, notebookEntries, messages, calendarEvents } = useStore()

  const myChildren = useMemo(
    () => children.filter((c) => c.facilityId === currentUser?.facilityId),
    [children, currentUser],
  )
  const todayTeacherEntries = notebookEntries.filter(
    (e) => e.date === TODAY && e.author === 'teacher',
  )
  const todayEvents = calendarEvents
    .filter((e) => e.date === TODAY)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  const recentMessages = [...messages].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 4)
  const parentMsgCount = messages.filter((m) => m.sender === 'parent').length

  const stats = [
    {
      label: '在園児',
      value: myChildren.length,
      unit: '名',
      icon: Users,
      color: 'oklch(0.67 0.13 158)',
    },
    {
      label: '本日の連絡帳',
      value: todayTeacherEntries.length,
      unit: `/ ${myChildren.length}`,
      icon: ClipboardList,
      color: 'oklch(0.78 0.13 75)',
    },
    {
      label: '保護者メッセージ',
      value: parentMsgCount,
      unit: '件',
      icon: MessageCircle,
      color: 'oklch(0.65 0.11 240)',
    },
    {
      label: '本日の予定',
      value: todayEvents.length,
      unit: '件',
      icon: CalendarClock,
      color: 'oklch(0.7 0.13 330)',
    },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <PageTitle title="ダッシュボード" subtitle={formatDate(TODAY)} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="p-4">
              <div
                className="mb-3 flex size-10 items-center justify-center rounded-2xl text-white"
                style={{ backgroundColor: s.color }}
              >
                <Icon className="size-5" />
              </div>
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="font-display text-2xl font-bold">
                {s.value}
                <span className="ml-1 text-sm font-semibold text-muted-foreground">{s.unit}</span>
              </p>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="font-display text-lg font-bold">本日のクラスの様子</h2>
            <Link href="/teacher/children" className="text-sm font-semibold text-primary">
              園児管理へ
            </Link>
          </div>
          <div className="divide-y divide-border">
            {myChildren.map((child) => {
              const entry = todayTeacherEntries.find((e) => e.childId === child.id)
              return (
                <Link
                  key={child.id}
                  href="/teacher/children"
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                >
                  <ChildAvatar name={child.name} color={child.avatarColor} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{child.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{child.className}</p>
                  </div>
                  {entry ? (
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                        style={{ backgroundColor: moodConfig[entry.mood].color }}
                      >
                        {moodConfig[entry.mood].emoji} {moodConfig[entry.mood].label}
                      </span>
                      <Badge className="gap-1 bg-primary/15 text-primary">
                        <CheckCircle2 className="size-3.5" />
                        記入済み
                      </Badge>
                    </div>
                  ) : (
                    <Badge className="bg-accent text-accent-foreground">未記入</Badge>
                  )}
                </Link>
              )
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="font-display text-lg font-bold">本日の予定</h2>
            </div>
            <div className="space-y-2 px-3 pb-3">
              {todayEvents.length > 0 ? (
                todayEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                    <span
                      className="h-9 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: eventColor[e.type] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.time ? `${e.time}〜` : '終日'}
                      </p>
                    </div>
                    <Badge>{e.type}</Badge>
                  </div>
                ))
              ) : (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  本日の予定はありません
                </p>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="font-display text-lg font-bold">最近のメッセージ</h2>
              <Link href="/teacher/messages" className="text-sm font-semibold text-primary">
                すべて
              </Link>
            </div>
            <div className="space-y-1 px-3 pb-3">
              {recentMessages.map((m) => {
                const child = children.find((c) => c.id === m.childId)
                return (
                  <Link
                    key={m.id}
                    href="/teacher/messages"
                    className="block rounded-2xl px-2 py-2 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-xs font-bold',
                          m.sender === 'parent' ? 'text-chart-3' : 'text-primary',
                        )}
                      >
                        {m.senderName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {child?.name.split(' ')[1]}
                      </span>
                      <span className="ml-auto text-[0.65rem] text-muted-foreground">
                        {formatTime(m.time)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-foreground/80">{m.text}</p>
                  </Link>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
