'use client'

import { useMemo, useState } from 'react'
import { Download, FileText, ImageIcon, Upload, Users } from 'lucide-react'
import { PageTitle } from '@/components/teacher/page-title'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatDate } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { SharedFile } from '@/lib/types'
import { cn } from '@/lib/utils'

const kindIcon = { PDF: FileText, 画像: ImageIcon, 文書: FileText }
const kindColor: Record<SharedFile['kind'], string> = {
  PDF: 'oklch(0.62 0.19 25)',
  画像: 'oklch(0.65 0.11 240)',
  文書: 'oklch(0.67 0.13 158)',
}

export default function TeacherFiles() {
  const { currentUser, children, sharedFiles, addFile } = useStore()
  const [open, setOpen] = useState(false)

  const files = useMemo(
    () =>
      [...sharedFiles]
        .filter((f) => f.facilityId === currentUser?.facilityId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [sharedFiles, currentUser],
  )
  const classes = useMemo(
    () => Array.from(new Set(children.map((c) => c.className.split('（')[0]))),
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
                    {file.sharedWith === 'all' ? '全園児' : file.className ?? '一部クラス'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{file.uploadedBy}</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="ダウンロード"
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Download className="size-5" />
              </button>
            </Card>
          )
        })}
      </div>

      <UploadModal
        open={open}
        onClose={() => setOpen(false)}
        classes={classes}
        onUpload={(file) =>
          addFile({
            ...file,
            facilityId: currentUser?.facilityId ?? 'f1',
            date: '2026-09-12',
            uploadedBy: currentUser?.name ?? '担任',
          })
        }
      />
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
  classes: string[]
  onUpload: (file: Omit<SharedFile, 'id' | 'facilityId' | 'date' | 'uploadedBy'>) => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SharedFile['kind']>('PDF')
  const [target, setTarget] = useState<'all' | string>('all')

  function submit() {
    const finalName = name.trim() || '無題の資料'
    const withExt =
      kind === 'PDF' && !finalName.toLowerCase().endsWith('.pdf') ? `${finalName}.pdf` : finalName
    onUpload({
      name: withExt,
      kind,
      sizeLabel: `${(Math.random() * 2 + 0.3).toFixed(1)} MB`,
      sharedWith: target === 'all' ? 'all' : [],
      className: target === 'all' ? undefined : target,
    })
    setName('')
    setKind('PDF')
    setTarget('all')
    onClose()
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
          <Button className="h-11 flex-[2] rounded-2xl font-bold" onClick={submit}>
            アップロードして共有
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-muted/40 px-4 py-8 text-center">
          <Upload className="size-8 text-muted-foreground" />
          <p className="text-sm font-semibold">ファイルをドラッグ＆ドロップ</p>
          <p className="text-xs text-muted-foreground">または下にファイル名を入力（デモ）</p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">資料名</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例）10月行事予定"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-semibold">種類</span>
          <div className="grid grid-cols-3 gap-2">
            {(['PDF', '画像', '文書'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'rounded-2xl border py-2.5 text-sm font-semibold transition-colors',
                  kind === k
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted',
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold">共有先</span>
          <div className="flex flex-wrap gap-2">
            <TargetChip label="全園児" active={target === 'all'} onClick={() => setTarget('all')} />
            {classes.map((c) => (
              <TargetChip
                key={c}
                label={c}
                active={target === c}
                onClick={() => setTarget(c)}
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
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
        active
          ? 'border-transparent bg-secondary text-secondary-foreground ring-2 ring-primary'
          : 'border-border bg-background text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  )
}
