'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Cake, NotebookPen, Pencil } from 'lucide-react'
import { NotebookEntryCard } from '@/components/notebook-entry-card'
import { PageTitle } from '@/components/teacher/page-title'
import { TeacherEntryDialog } from '@/components/teacher/teacher-entry-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChildAvatar } from '@/components/ui/child-avatar'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { ageFromBirthday, formatDate } from '@/lib/format'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export default function TeacherChildren() {
  const { currentUser, children, notebookEntries, updateChild } = useStore()
  const myChildren = useMemo(
    () => children.filter((c) => c.facilityId === currentUser?.facilityId),
    [children, currentUser],
  )
  const [selectedId, setSelectedId] = useState(myChildren[0]?.id ?? '')
  const [entryOpen, setEntryOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const selected = myChildren.find((c) => c.id === selectedId) ?? myChildren[0]
  const entries = notebookEntries
    .filter((e) => e.childId === selected?.id)
    .sort((a, b) => b.date.localeCompare(a.date))

  if (!selected) return null

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageTitle title="園児管理" subtitle="お子さまの情報と連絡帳の記入・管理" />

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card className="h-fit p-2">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">
            園児一覧（{myChildren.length}名）
          </p>
          <ul className="space-y-1">
            {myChildren.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(child.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
                    selected.id === child.id ? 'bg-secondary' : 'hover:bg-muted',
                  )}
                >
                  <ChildAvatar name={child.name} color={child.avatarColor} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{child.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{child.className}</p>
                  </div>
                  {child.allergies.length > 0 && (
                    <AlertTriangle className="size-4 shrink-0 text-destructive" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <ChildAvatar name={selected.name} color={selected.avatarColor} size={64} />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-bold">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{selected.kana}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <Badge>{selected.className}</Badge>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Cake className="size-4" />
                    {ageFromBirthday(selected.birthday)}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                className="h-9 rounded-2xl"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
                編集
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-muted/60 p-3.5">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <AlertTriangle className="size-3.5 text-destructive" />
                  アレルギー
                </p>
                {selected.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.allergies.map((a) => (
                      <Badge key={a} className="bg-destructive/15 text-destructive">
                        {a}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">なし</p>
                )}
              </div>
              <div className="rounded-2xl bg-muted/60 p-3.5">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">申し送り・メモ</p>
                <p className="text-sm leading-relaxed">{selected.notes || 'なし'}</p>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">連絡帳の記録</h3>
            <Button className="h-10 rounded-2xl font-bold" onClick={() => setEntryOpen(true)}>
              <NotebookPen className="size-4" />
              連絡帳を記入
            </Button>
          </div>

          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id}>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  {formatDate(entry.date)}
                </p>
                <NotebookEntryCard entry={entry} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <TeacherEntryDialog open={entryOpen} onClose={() => setEntryOpen(false)} child={selected} />
      <EditChildModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        child={selected}
        onSave={(patch) => updateChild(selected.id, patch)}
      />
    </div>
  )
}

function EditChildModal({
  open,
  onClose,
  child,
  onSave,
}: {
  open: boolean
  onClose: () => void
  child: { allergies: string[]; notes: string }
  onSave: (patch: { allergies: string[]; notes: string }) => Promise<void>
}) {
  const [allergies, setAllergies] = useState(child.allergies.join('、'))
  const [notes, setNotes] = useState(child.notes)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      await onSave({
        allergies: allergies
          .split(/[、,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        notes,
      })
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
      title="園児情報を編集"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            className="h-11 flex-[2] rounded-2xl font-bold"
            onClick={save}
            disabled={isSaving}
          >
            保存する
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
          <span className="mb-1.5 block text-sm font-semibold">
            アレルギー（読点や空白で区切り）
          </span>
          <Input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="例）卵、乳"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">申し送り・メモ</span>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
    </Modal>
  )
}
