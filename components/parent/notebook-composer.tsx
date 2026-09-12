'use client'

import { useState } from 'react'
import { PencilLine } from 'lucide-react'
import { EntryDialog } from '@/components/parent/entry-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate, todayInTimeZone } from '@/lib/format'
import { nextAttendanceDate, notebookDateOptions } from '@/lib/parent-notebook-date'
import { useStore } from '@/lib/store'
import { useCurrentTime } from '@/lib/use-current-time'
import type { Child, NotebookEntry } from '@/lib/types'

export function NotebookComposer({
  child,
  label = '子どもの様子を登録する',
  allowDateSelection = false,
}: {
  child: Child
  label?: string
  allowDateSelection?: boolean
}) {
  const { currentUser, notebookEntries, calendarEvents } = useStore()
  const now = useCurrentTime()
  const [selectedDate, setDate] = useState(() => todayInTimeZone())
  const date = allowDateSelection
    ? selectedDate
    : nextAttendanceDate(now, calendarEvents, child.classId)
  const [editor, setEditor] = useState<{
    child: Child
    date: string
    entry?: NotebookEntry
  } | null>(null)
  const entry = notebookEntries.find(
    (entry) =>
      entry.childId === child.id &&
      entry.authorId === currentUser?.id &&
      entry.date === date &&
      entry.status !== 'withdrawn',
  )

  return (
    <div className="space-y-3">
      {allowDateSelection && (
        <>
          <label className="block text-sm font-semibold">
            <span className="mb-1.5 block">連絡帳の日付</span>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            {notebookDateOptions(todayInTimeZone(now)).map((option) => (
              <Button
                key={option.label}
                variant={date === option.date ? 'secondary' : 'outline'}
                aria-pressed={date === option.date}
                onClick={() => setDate(option.date)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </>
      )}
      <Button
        onClick={() => setEditor({ child, date, entry })}
        disabled={!date || Boolean(entry?.confirmedAt)}
        className="h-auto min-h-14 w-full rounded-3xl py-3 text-base font-bold shadow-sm"
      >
        <PencilLine className="size-5" />
        <span className="flex flex-col items-center">
          {!allowDateSelection && <span className="text-xs">{formatDate(date)}の連絡帳</span>}
          <span>{entry?.confirmedAt ? '園で確認済みです' : label}</span>
        </span>
      </Button>
      {editor && (
        <EntryDialog
          key={editor.entry?.id ?? `${editor.child.id}-${editor.date}`}
          open
          onClose={() => setEditor(null)}
          child={editor.child}
          date={editor.date}
          entry={editor.entry}
        />
      )}
    </div>
  )
}
