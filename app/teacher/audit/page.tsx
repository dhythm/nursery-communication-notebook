'use client'

import { PageTitle } from '@/components/teacher/page-title'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatDate, formatTime } from '@/lib/format'
import { useStore } from '@/lib/store'

const actionLabel: Record<string, string> = {
  created: '作成',
  updated: '更新',
  published: '配信',
  draft_saved: '下書き保存',
  withdrawn: '取消',
  cancelled: '取消',
  read: '既読',
  confirmed: '確認',
  uploaded: 'アップロード',
}
const entityLabel: Record<string, string> = {
  child: '園児',
  notebook_entry: '連絡帳',
  notice: 'お知らせ',
  calendar_event: '予定',
  message: 'メッセージ',
  file: '資料',
  notification_preference: '通知設定',
  notification: '通知',
}

export default function AuditPage() {
  const { auditEvents } = useStore()
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <PageTitle title="操作履歴" subtitle="重要な作成・訂正・取消・確認を記録します" />
      <Card className="divide-y p-0">
        {auditEvents.map((event) => (
          <div key={event.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {event.actorName} が {entityLabel[event.entityType] ?? event.entityType}を
                {actionLabel[event.action] ?? event.action}
              </p>
              <p className="truncate text-xs text-muted-foreground">{event.entityId}</p>
            </div>
            <Badge>
              {event.actorRole === 'teacher'
                ? '職員'
                : event.actorRole === 'parent'
                  ? '保護者'
                  : 'システム'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(event.occurredAt.slice(0, 10))} {formatTime(event.occurredAt)}
            </span>
          </div>
        ))}
        {auditEvents.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">操作履歴はありません</p>
        )}
      </Card>
    </div>
  )
}
