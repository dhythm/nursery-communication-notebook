'use client'

import { Download, FileText, ImageIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { useStore } from '@/lib/store'
import { useParams } from 'next/navigation'
import { facilityApiPath } from '@/lib/facility-path'

export default function ParentFilesPage() {
  const { sharedFiles } = useStore()
  const { facilitySlug } = useParams<{ facilitySlug: string }>()
  return (
    <div className="space-y-4 p-4 pb-8">
      <h1 className="pt-1 font-display text-xl font-bold">資料</h1>
      <div className="space-y-3">
        {sharedFiles.map((file) => {
          const Icon = file.kind === '画像' ? ImageIcon : FileText
          return (
            <Card key={file.id} className="flex items-center gap-3 p-4">
              <span className="rounded-2xl bg-secondary p-3 text-primary">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {file.kind}・{file.sizeLabel}・{formatDate(file.date)}
                </p>
                {file.className && <Badge className="mt-1">{file.className}</Badge>}
              </div>
              <a
                href={facilityApiPath(facilitySlug, `/files/${file.id}`)}
                aria-label={`${file.name}をダウンロード`}
                className="rounded-full p-2 hover:bg-muted"
              >
                <Download className="size-5" />
              </a>
            </Card>
          )
        })}
        {sharedFiles.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            共有された資料はありません
          </p>
        )}
      </div>
    </div>
  )
}
