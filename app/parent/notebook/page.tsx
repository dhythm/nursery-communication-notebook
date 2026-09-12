'use client'

import { useMemo, useState } from 'react'
import { PencilLine } from 'lucide-react'
import { EntryDialog } from '@/components/parent/entry-dialog'
import { NotebookEntryCard } from '@/components/notebook-entry-card'
import { Button } from '@/components/ui/button'
import { formatDate, todayInTimeZone } from '@/lib/format'
import { useParent } from '@/lib/parent-context'
import { useStore } from '@/lib/store'
import type { NotebookEntry } from '@/lib/types'

export default function ParentNotebook() {
  const { currentUser, notebookEntries, withdrawNotebookEntry } = useStore()
  const { selectedChild } = useParent()
  const [editingEntry, setEditingEntry] = useState<NotebookEntry | 'new' | null>(null)

  const grouped = useMemo(() => {
    if (!selectedChild) return []
    const entries = notebookEntries
      .filter((e) => e.childId === selectedChild.id)
      .sort((a, b) => b.date.localeCompare(a.date))
    const map = new Map<string, typeof entries>()
    for (const e of entries) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return [...map.entries()]
  }, [notebookEntries, selectedChild])

  if (!selectedChild) return null

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="font-display text-xl font-bold">連絡帳</h1>
          <p className="text-sm text-muted-foreground">
            {selectedChild.name.split(' ')[1] ?? selectedChild.name} さんの記録
          </p>
        </div>
        <Button
          onClick={() =>
            setEditingEntry(
              notebookEntries.find(
                (entry) =>
                  entry.childId === selectedChild.id &&
                  entry.authorId === currentUser?.id &&
                  entry.date === todayInTimeZone(),
              ) ?? 'new',
            )
          }
          className="h-10 rounded-2xl font-bold"
        >
          <PencilLine className="size-4" />
          記入
        </Button>
      </div>

      {grouped.map(([date, entries]) => (
        <section key={date} className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              {formatDate(date)}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          {entries.map((entry) => (
            <NotebookEntryCard
              key={entry.id}
              entry={entry}
              onEdit={
                entry.authorId === currentUser?.id && !entry.confirmedAt
                  ? () => setEditingEntry(entry)
                  : undefined
              }
              onWithdraw={
                entry.authorId === currentUser?.id && !entry.confirmedAt
                  ? () => void withdrawNotebookEntry(entry.id, entry.version ?? 1)
                  : undefined
              }
            />
          ))}
        </section>
      ))}

      {editingEntry && (
        <EntryDialog
          key={editingEntry === 'new' ? selectedChild.id : editingEntry.id}
          open
          onClose={() => setEditingEntry(null)}
          child={selectedChild}
          entry={editingEntry === 'new' ? undefined : editingEntry}
        />
      )}
    </div>
  )
}
