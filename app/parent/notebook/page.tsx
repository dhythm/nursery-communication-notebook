'use client'

import { useMemo, useState } from 'react'
import { EntryDialog } from '@/components/parent/entry-dialog'
import { NotebookEntryCard } from '@/components/notebook-entry-card'
import { NotebookComposer } from '@/components/parent/notebook-composer'
import { formatDate } from '@/lib/format'
import { useParent } from '@/lib/parent-context'
import { useStore } from '@/lib/store'
import type { Child, NotebookEntry } from '@/lib/types'

export default function ParentNotebook() {
  const { currentUser, notebookEntries, withdrawNotebookEntry } = useStore()
  const { selectedChild } = useParent()
  const [editor, setEditor] = useState<{ child: Child; entry: NotebookEntry } | null>(null)

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
      </div>

      <NotebookComposer child={selectedChild} label="記入" allowDateSelection />

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
                  ? () => setEditor({ child: selectedChild, entry })
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

      {editor && (
        <EntryDialog
          key={editor.entry.id}
          open
          onClose={() => setEditor(null)}
          child={editor.child}
          date={editor.entry.date}
          entry={editor.entry}
        />
      )}
    </div>
  )
}
