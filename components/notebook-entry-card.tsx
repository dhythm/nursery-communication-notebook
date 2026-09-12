import Image from 'next/image'
import { Moon, Pencil, Thermometer, Toilet, Undo2, UtensilsCrossed } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { moodConfig, formatDate } from '@/lib/format'
import type { NotebookEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

const rows = [
  { key: 'temperature', label: '体温', icon: Thermometer, suffix: '℃' },
  { key: 'meals', label: '食事', icon: UtensilsCrossed },
  { key: 'nap', label: '睡眠', icon: Moon },
  { key: 'toilet', label: '排せつ', icon: Toilet },
] as const

export function NotebookEntryCard({
  entry,
  showDate = false,
  onEdit,
  onWithdraw,
}: {
  entry: NotebookEntry
  showDate?: boolean
  onEdit?: () => void
  onWithdraw?: () => void
}) {
  const mood = moodConfig[entry.mood]
  const isTeacher = entry.author === 'teacher'

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-4 py-3',
          isTeacher ? 'bg-secondary' : 'bg-muted',
        )}
      >
        <div className="flex items-center gap-2">
          <Badge className={cn('text-white', isTeacher ? 'bg-primary' : 'bg-chart-3')}>
            {isTeacher ? '園から' : 'ご家庭から'}
          </Badge>
          <span className="text-sm font-semibold">{entry.authorName}</span>
          {entry.status === 'draft' && (
            <Badge className="bg-accent text-accent-foreground">下書き</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {showDate && (
            <span className="text-xs font-medium text-muted-foreground">
              {formatDate(entry.date)}
            </span>
          )}
          {onEdit && (
            <button
              type="button"
              aria-label="編集"
              className="rounded-full p-1.5 hover:bg-background/70"
              onClick={onEdit}
            >
              <Pencil className="size-4" />
            </button>
          )}
          {onWithdraw && entry.status === 'published' && (
            <button
              type="button"
              aria-label="送信取消"
              className="rounded-full p-1.5 text-destructive hover:bg-background/70"
              onClick={onWithdraw}
            >
              <Undo2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: mood.color }}
        >
          <span className="text-lg leading-none">{mood.emoji}</span>
          今日のごきげん：{mood.label}
        </div>

        <dl className="grid gap-2">
          {rows.map((row) => {
            const Icon = row.icon
            const value = entry[row.key]
            return (
              <div key={row.key} className="flex gap-2.5 rounded-2xl bg-muted/60 px-3 py-2">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold text-muted-foreground">{row.label}</dt>
                  <dd className="text-sm leading-relaxed">
                    {value}
                    {'suffix' in row && row.suffix ? row.suffix : ''}
                  </dd>
                </div>
              </div>
            )
          })}
        </dl>

        {entry.note && (
          <p className="whitespace-pre-wrap rounded-2xl bg-accent/40 px-3 py-2.5 text-sm leading-relaxed">
            {entry.note}
          </p>
        )}

        {entry.photo && (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl">
            <Image src={entry.photo} alt="今日のようす" fill className="object-cover" />
          </div>
        )}
      </div>
    </article>
  )
}
