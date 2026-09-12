import Image from 'next/image'
import {
  Clock3,
  Moon,
  Pencil,
  Thermometer,
  Toilet,
  Undo2,
  UserRound,
  UtensilsCrossed,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { moodConfig, formatDate } from '@/lib/format'
import { pickupPersonLabels, stoolConditionLabels } from '@/lib/notebook-form'
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
  const hasStructuredHomeDetails = !isTeacher && Boolean(entry.eveningMeal)

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
          {isTeacher ? '今日' : '今朝'}のごきげん：{mood.label}
        </div>

        {hasStructuredHomeDetails ? (
          <StructuredHomeDetails entry={entry} />
        ) : (
          <dl className="grid gap-2">
            {rows.map((row) => {
              const Icon = row.icon
              const value = entry[row.key]
              return (
                <DetailRow key={row.key} icon={Icon} label={row.label}>
                  {value}
                  {'suffix' in row && row.suffix ? row.suffix : ''}
                </DetailRow>
              )
            })}
          </dl>
        )}

        {entry.condition && (
          <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
            <p className="text-xs font-semibold text-muted-foreground">子どもの様子</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{entry.condition}</p>
          </div>
        )}
        {entry.note && (
          <div className="rounded-2xl bg-accent/40 px-3 py-2.5">
            <p className="text-xs font-semibold text-muted-foreground">
              {isTeacher ? '今日のようす・連絡事項' : '連絡事項'}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{entry.note}</p>
          </div>
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

function StructuredHomeDetails({ entry }: { entry: NotebookEntry }) {
  const eveningStool = entry.eveningStool
    ? `${stoolConditionLabels[entry.eveningStool]}・${entry.eveningStoolCount ?? 0}回`
    : '記入なし'
  const morningStool = entry.morningStool
    ? `${stoolConditionLabels[entry.morningStool]}・${entry.morningStoolCount ?? 0}回`
    : '記入なし'
  const pickupPerson = entry.pickupPerson
    ? entry.pickupPerson === 'other' && entry.pickupPersonName
      ? entry.pickupPersonName
      : pickupPersonLabels[entry.pickupPerson]
    : '記入なし'

  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      <DetailRow icon={UtensilsCrossed} label="昨晩の夕食">
        {entry.eveningMeal}
      </DetailRow>
      <DetailRow icon={Moon} label="就寝時間">
        {entry.bedtime}
      </DetailRow>
      <DetailRow icon={Toilet} label="昨晩の排便">
        {eveningStool}
      </DetailRow>
      <DetailRow icon={Clock3} label="起床時間">
        {entry.wakeTime}
      </DetailRow>
      <DetailRow icon={UtensilsCrossed} label="今朝の朝食">
        {entry.breakfast}
      </DetailRow>
      <DetailRow icon={Toilet} label="今朝の排便">
        {morningStool}
      </DetailRow>
      <DetailRow icon={Thermometer} label="今朝の体温">
        {entry.temperature}℃
        {entry.temperatureMeasuredAt ? `（${entry.temperatureMeasuredAt}測定）` : ''}
      </DetailRow>
      <DetailRow icon={UserRound} label="お迎え予定">
        {pickupPerson}・{entry.pickupTime}
      </DetailRow>
    </dl>
  )
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Thermometer
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-2.5 rounded-2xl bg-muted/60 px-3 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
        <dd className="text-sm leading-relaxed">{children}</dd>
      </div>
    </div>
  )
}
