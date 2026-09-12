'use client'

import { useMemo, useState } from 'react'
import { Megaphone, Pencil, Plus, Undo2 } from 'lucide-react'
import { PageTitle } from '@/components/teacher/page-title'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Notice } from '@/lib/types'

export default function TeacherNoticesPage() {
  const { notices, saveNotice, updateNotice, withdrawNotice } = useStore()
  const [editing, setEditing] = useState<Notice | null | 'new'>(null)
  const list = useMemo(() => [...notices].sort((a, b) => b.date.localeCompare(a.date)), [notices])
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <PageTitle
        title="お知らせ"
        subtitle="作成、配信、確認状況を管理します"
        action={
          <Button className="rounded-2xl" onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            新規作成
          </Button>
        }
      />
      <div className="space-y-3">
        {list.map((notice) => (
          <Card key={notice.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="rounded-2xl bg-secondary p-2">
                <Megaphone className="size-5 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{notice.category}</Badge>
                  <Badge
                    className={
                      notice.status === 'draft'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-primary text-primary-foreground'
                    }
                  >
                    {notice.status === 'draft' ? '下書き' : '配信中'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(notice.date)}</span>
                </div>
                <h2 className="mt-2 font-bold">{notice.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{notice.body}</p>
                {notice.status === 'published' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    既読 {notice.readCount ?? 0}/{notice.recipientCount ?? 0}
                    {notice.requiresConfirmation &&
                      `・確認 ${notice.confirmationCount ?? 0}/${notice.recipientCount ?? 0}`}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="編集"
                  className="rounded-full p-2 hover:bg-muted"
                  onClick={() => setEditing(notice)}
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="配信取消"
                  className="rounded-full p-2 text-destructive hover:bg-muted"
                  onClick={() => void withdrawNotice(notice.id, notice.version ?? 1)}
                >
                  <Undo2 className="size-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {editing && (
        <NoticeEditor
          notice={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            if (editing === 'new') await saveNotice(payload)
            else await updateNotice(editing.id, editing.version ?? 1, payload)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function NoticeEditor({
  notice,
  onClose,
  onSave,
}: {
  notice?: Notice
  onClose: () => void
  onSave: (
    payload: Omit<Notice, 'id' | 'facilityId' | 'date'> & { status: 'draft' | 'published' },
  ) => Promise<void>
}) {
  const { children } = useStore()
  const classes = useMemo(
    () => Array.from(new Map(children.map((child) => [child.classId, child.className])).entries()),
    [children],
  )
  const [title, setTitle] = useState(notice?.title ?? '')
  const [body, setBody] = useState(notice?.body ?? '')
  const [category, setCategory] = useState<Notice['category']>(notice?.category ?? 'お願い')
  const [targetClassId, setTargetClassId] = useState(notice?.targetClassId ?? '')
  const [requiresConfirmation, setRequiresConfirmation] = useState(
    notice?.requiresConfirmation ?? false,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(status: 'draft' | 'published') {
    if (saving || !title.trim()) return
    setSaving(true)
    setError('')
    try {
      await onSave({
        title: title.trim(),
        body,
        category,
        pinned: notice?.pinned ?? false,
        requiresConfirmation,
        targetClassId: targetClassId || null,
        status,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存できませんでした')
      setSaving(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={notice ? 'お知らせを編集' : 'お知らせを作成'}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void submit('draft')} disabled={saving}>
            下書き保存
          </Button>
          <Button onClick={() => void submit('published')} disabled={saving || !title.trim()}>
            配信する
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
        <label className="block text-sm font-semibold">
          タイトル
          <Input
            className="mt-1"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          本文
          <Textarea
            className="mt-1 min-h-32"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          分類
          <select
            className="mt-1 h-10 w-full rounded-xl border bg-background px-3"
            value={category}
            onChange={(event) => setCategory(event.target.value as Notice['category'])}
          >
            {['重要', 'イベント', '保健', '給食', 'お願い'].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          配信先
          <select
            className="mt-1 h-10 w-full rounded-xl border bg-background px-3"
            value={targetClassId}
            onChange={(event) => setTargetClassId(event.target.value)}
          >
            <option value="">全園児</option>
            {classes.map(([classId, name]) => (
              <option key={classId} value={classId}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={requiresConfirmation}
            onChange={(event) => setRequiresConfirmation(event.target.checked)}
          />
          確認を必須にする
        </label>
      </div>
    </Modal>
  )
}
