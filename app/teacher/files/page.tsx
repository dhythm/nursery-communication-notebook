'use client'

import { useMemo, useState } from 'react'
import { Download, FileText, ImageIcon, Trash2, Upload, Users } from 'lucide-react'
import { PageTitle } from '@/components/teacher/page-title'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatDate } from '@/lib/format'
import { useStore } from '@/lib/store'
import { useParams } from 'next/navigation'
import { facilityApiPath } from '@/lib/facility-path'
import type { SharedFile } from '@/lib/types'

const kindIcon = { PDF: FileText, 画像: ImageIcon, 文書: FileText }
const kindColor: Record<SharedFile['kind'], string> = {
  PDF: 'oklch(0.62 0.19 25)',
  画像: 'oklch(0.65 0.11 240)',
  文書: 'oklch(0.67 0.13 158)',
}

export default function TeacherFiles() {
  const { currentUser, children, sharedFiles, uploadFile, deleteFile } = useStore()
  const { facilitySlug } = useParams<{ facilitySlug: string }>()
  const [open, setOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<SharedFile | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function confirmDelete() {
    if (!fileToDelete || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteFile(fileToDelete.id)
      setFileToDelete(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '削除できませんでした。')
    } finally {
      setIsDeleting(false)
    }
  }

  const files = useMemo(
    () =>
      [...sharedFiles]
        .filter((f) => f.facilityId === currentUser?.facilityId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [sharedFiles, currentUser],
  )
  const classes = useMemo(
    () => Array.from(new Map(children.map((child) => [child.classId, child.className])).entries()),
    [children],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <PageTitle
        title="資料共有"
        subtitle="PDFや資料をアップロードして保護者に共有します"
        action={
          <Button className="h-10 rounded-2xl font-bold" onClick={() => setOpen(true)}>
            <Upload className="size-4" />
            資料をアップロード
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {files.map((file) => {
          const Icon = kindIcon[file.kind]
          return (
            <Card key={file.id} className="flex items-center gap-4 p-4">
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white"
                style={{ backgroundColor: kindColor[file.kind] }}
              >
                <Icon className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {file.kind}・{file.sizeLabel}・{formatDate(file.date)}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge className="gap-1">
                    <Users className="size-3" />
                    {file.sharedWith === 'all' ? '全園児' : (file.className ?? '一部クラス')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{file.uploadedBy}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={facilityApiPath(facilitySlug, `/files/${file.id}`)}
                  aria-label={`${file.name}をダウンロード`}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Download className="size-5" />
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`${file.name}の公開を取り消す`}
                  className="rounded-full text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setDeleteError(null)
                    setFileToDelete(file)
                  }}
                >
                  <Trash2 className="size-5" />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <UploadModal
        open={open}
        onClose={() => setOpen(false)}
        classes={classes}
        onUpload={uploadFile}
      />
      <Modal
        open={fileToDelete !== null}
        onClose={() => !isDeleting && setFileToDelete(null)}
        title="資料の公開を取り消す"
        footer={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-2xl"
              disabled={isDeleting}
              onClick={() => setFileToDelete(null)}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              className="h-11 flex-[2] rounded-2xl font-bold"
              disabled={isDeleting}
              onClick={() => void confirmDelete()}
            >
              公開を取り消す
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm font-semibold">{fileToDelete?.name}</p>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

function UploadModal({
  open,
  onClose,
  classes,
  onUpload,
}: {
  open: boolean
  onClose: () => void
  classes: [string, string][]
  onUpload: (file: File, displayName: string, targetClassId?: string) => Promise<string>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState<'all' | string>('all')

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      if (!file) return
      await onUpload(file, name.trim() || file.name, target === 'all' ? undefined : target)
      setFile(null)
      setName('')
      setTarget('all')
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
      title="資料をアップロード"
      description="保護者に共有する資料を登録します"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            className="h-11 flex-[2] rounded-2xl font-bold"
            onClick={submit}
            disabled={isSaving || !file}
          >
            アップロードして共有
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
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-muted/40 px-4 py-8 text-center">
          <Upload className="size-8 text-muted-foreground" />
          <p className="text-sm font-semibold">{file ? file.name : 'ファイルを選択'}</p>
          {file && (
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
          )}
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null
              setFile(selected)
              if (selected && !name) setName(selected.name)
            }}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">資料名</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例）10月行事予定"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-semibold">共有先</span>
          <div className="flex flex-wrap gap-2">
            <TargetChip label="全園児" active={target === 'all'} onClick={() => setTarget('all')} />
            {classes.map(([classId, className]) => (
              <TargetChip
                key={classId}
                label={className}
                active={target === classId}
                onClick={() => setTarget(classId)}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function TargetChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? 'border-transparent bg-secondary text-secondary-foreground ring-2 ring-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
    >
      {label}
    </button>
  )
}
