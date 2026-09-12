'use client'

import { useMemo, useState } from 'react'
import { Pin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Notice } from '@/lib/types'
import { cn } from '@/lib/utils'

const categories: (Notice['category'] | 'すべて')[] = [
  'すべて',
  'イベント',
  '保健',
  '給食',
  'お願い',
  '重要',
]

const categoryColor: Record<Notice['category'], string> = {
  重要: 'oklch(0.62 0.19 25)',
  イベント: 'oklch(0.67 0.13 158)',
  保健: 'oklch(0.65 0.11 240)',
  給食: 'oklch(0.78 0.13 75)',
  お願い: 'oklch(0.7 0.13 330)',
}

export default function ParentNotices() {
  const { notices, markNoticeRead, confirmNotice } = useStore()
  const [filter, setFilter] = useState<(typeof categories)[number]>('すべて')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const list = useMemo(() => {
    const filtered = filter === 'すべて' ? notices : notices.filter((n) => n.category === filter)
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.date.localeCompare(a.date)
    })
  }, [notices, filter])

  return (
    <div className="space-y-4 p-4 pb-8">
      <h1 className="pt-1 font-display text-xl font-bold">お知らせ</h1>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
              filter === cat
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.map((notice) => (
          <article
            key={notice.id}
            className="rounded-3xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <Badge
                className="text-white"
                style={{ backgroundColor: categoryColor[notice.category] }}
              >
                {notice.category}
              </Badge>
              {notice.pinned && (
                <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                  <Pin className="size-3.5" />
                  固定
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDate(notice.date)}
              </span>
            </div>
            <h2 className="font-display text-base font-bold">{notice.title}</h2>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {notice.body}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {notice.readAt ? '既読' : '未読'}
              </span>
              {expandedId !== notice.id ? (
                <Button
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={() => {
                    setExpandedId(notice.id)
                    if (!notice.readAt) void markNoticeRead(notice.id)
                  }}
                >
                  詳細を確認
                </Button>
              ) : notice.requiresConfirmation && !notice.confirmedAt ? (
                <Button className="h-9 rounded-xl" onClick={() => void confirmNotice(notice.id)}>
                  確認しました
                </Button>
              ) : notice.requiresConfirmation ? (
                <Badge className="bg-primary text-primary-foreground">確認済み</Badge>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
