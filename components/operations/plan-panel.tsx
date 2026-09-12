'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useStore } from '@/lib/store'
import { todayInTimeZone } from '@/lib/format'
import type { PlanRecord } from '@/lib/operations/risk-plans'
import { useOperations } from './use-operations'

const periodLabel = { monthly: '月案', weekly: '週案', daily: '日案' }
const statusLabel = { draft: '下書き', submitted: '承認待ち', approved: '承認済み' }
type EditorState =
  { mode: 'create' } | { mode: 'update' | 'copy' | 'evaluate' | 'return'; record: PlanRecord }

export function PlanPanel() {
  const { nurseryClasses, members, currentUser } = useStore()
  const { data, error, isLoading, isPending, mutate, refresh } =
    useOperations<PlanRecord[]>('plans')
  const [editing, setEditing] = useState<EditorState | null>(null)
  const [classId, setClassId] = useState('all')
  const [status, setStatus] = useState('all')
  const [period, setPeriod] = useState('all')
  const [notice, setNotice] = useState('')
  if (isLoading) return <p role="status">指導計画を読み込み中…</p>
  if (!data)
    return (
      <div>
        <p role="alert">{error || '指導計画を読み込めませんでした'}</p>
        <Button onClick={refresh}>再読み込み</Button>
      </div>
    )
  const records = data.filter(
    (item) =>
      (classId === 'all' || item.classId === classId) &&
      (status === 'all' || item.status === status) &&
      (period === 'all' || item.period === period),
  )
  async function transition(record: PlanRecord, type: 'submit' | 'approve') {
    if (await mutate({ type, payload: { id: record.id, version: record.version } }))
      setNotice(type === 'submit' ? '承認を依頼しました' : '計画を承認しました')
  }
  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">
          下書き {data.filter((item) => item.status === 'draft').length}件 ・ 承認待ち{' '}
          {data.filter((item) => item.status === 'submitted').length}件
        </p>
        <Button
          size="lg"
          disabled={isPending || editing !== null || !nurseryClasses.length}
          onClick={() => {
            setNotice('')
            setEditing({ mode: 'create' })
          }}
        >
          計画を作成
        </Button>
      </div>
      {editing && (
        <PlanEditor
          key={editing.mode === 'create' ? 'create' : `${editing.mode}-${editing.record.id}`}
          editing={editing}
          isPending={isPending}
          onCancel={() => setEditing(null)}
          onSave={async (payload) => {
            if (await mutate({ type: editing.mode, payload })) {
              setEditing(null)
              setNotice(
                editing.mode === 'copy'
                  ? '新しい期間の下書きを作成しました'
                  : editing.mode === 'return'
                    ? '修正を依頼しました'
                    : '計画を保存しました',
              )
            }
          }}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm font-medium">
          クラス
          <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="all">すべて</option>
            {nurseryClasses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          種別
          <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="all">すべて</option>
            <option value="monthly">月案</option>
            <option value="weekly">週案</option>
            <option value="daily">日案</option>
          </Select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          状態
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">すべて</option>
            <option value="draft">下書き</option>
            <option value="submitted">承認待ち</option>
            <option value="approved">承認済み</option>
          </Select>
        </label>
      </div>
      {records.length === 0 && (
        <p className="py-6 text-muted-foreground">該当する計画はありません</p>
      )}
      {records.map((record) => (
        <article key={record.id} className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">
              {nurseryClasses.find((item) => item.id === record.classId)?.name || 'クラス'} ・{' '}
              {periodLabel[record.period]}
            </h2>
            <span className="text-sm font-semibold">{statusLabel[record.status]}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {record.startDate} 〜 {record.endDate} ・ 作成者{' '}
            {members.find((member) => member.id === record.authorId)?.name || '職員'}
          </p>
          {record.reviewComment && (
            <p className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">
              修正依頼：{record.reviewComment}
            </p>
          )}
          <dl className="space-y-3 text-sm">
            {(
              [
                ['goals', 'ねらい'],
                ['activities', '活動内容'],
                ['support', '環境・援助'],
                ['evaluation', '評価・振り返り'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <dt className="font-medium">{label}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">{record[key] || '未記入'}</dd>
              </div>
            ))}
          </dl>
          {record.approvedBy && (
            <p className="text-sm text-muted-foreground">
              承認者 {members.find((member) => member.id === record.approvedBy)?.name || '管理者'}{' '}
              ・{' '}
              {record.approvedAt &&
                new Date(record.approvedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {record.status === 'draft' && (
              <>
                <Button
                  variant="outline"
                  disabled={isPending || editing !== null}
                  onClick={() => setEditing({ mode: 'update', record })}
                >
                  編集
                </Button>
                <Button
                  disabled={
                    isPending ||
                    editing !== null ||
                    !record.goals.trim() ||
                    !record.activities.trim() ||
                    !record.support.trim()
                  }
                  onClick={() => transition(record, 'submit')}
                >
                  承認を依頼
                </Button>
              </>
            )}
            {record.status === 'submitted' && currentUser?.canManageFacility && (
              <>
                <Button
                  disabled={isPending || editing !== null}
                  onClick={() => transition(record, 'approve')}
                >
                  承認
                </Button>
                <Button
                  variant="outline"
                  disabled={isPending || editing !== null}
                  onClick={() => setEditing({ mode: 'return', record })}
                >
                  修正を依頼
                </Button>
              </>
            )}
            {record.status === 'approved' && (
              <Button
                variant="outline"
                disabled={isPending || editing !== null}
                onClick={() => setEditing({ mode: 'evaluate', record })}
              >
                評価を記入
              </Button>
            )}
            <Button
              variant="outline"
              disabled={isPending || editing !== null}
              onClick={() => setEditing({ mode: 'copy', record })}
            >
              次の計画にコピー
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function PlanEditor({
  editing,
  isPending,
  onCancel,
  onSave,
}: {
  editing: EditorState
  isPending: boolean
  onCancel: () => void
  onSave: (payload: unknown) => Promise<void>
}) {
  const { nurseryClasses } = useStore()
  const record = editing.mode === 'create' ? undefined : editing.record
  const [period, setPeriod] = useState(record?.period || 'monthly')
  const [startDate, setStartDate] = useState(
    editing.mode === 'copy' ? '' : record?.startDate || todayInTimeZone(),
  )
  const [endDate, setEndDate] = useState(
    editing.mode === 'copy' ? '' : record?.endDate || todayInTimeZone(),
  )
  const [formError, setFormError] = useState('')
  const title = {
    create: '新しい計画',
    update: '計画を編集',
    copy: '新しい期間へコピー',
    evaluate: '評価・振り返り',
    return: '修正を依頼',
  }[editing.mode]
  const fullForm = editing.mode === 'create' || editing.mode === 'update'
  const periodForm = fullForm || editing.mode === 'copy'
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const form = new FormData(event.currentTarget)
    const payload: Record<string, unknown> = record
      ? { id: record.id, version: record.version }
      : {}
    if (periodForm) {
      const end = period === 'daily' ? startDate : endDate
      const span = (Date.parse(end) - Date.parse(startDate)) / 86400000
      if (
        span < 0 ||
        (period === 'weekly' && span > 6) ||
        (period === 'monthly' && startDate.slice(0, 7) !== end.slice(0, 7))
      ) {
        setFormError(
          period === 'weekly'
            ? '週案の期間は7日以内で入力してください'
            : '開始日と終了日を同じ月内で入力してください',
        )
        return
      }
      Object.assign(payload, { startDate, endDate: end })
    }
    if (fullForm)
      Object.assign(payload, {
        classId: form.get('classId'),
        period,
        goals: form.get('goals'),
        activities: form.get('activities'),
        support: form.get('support'),
      })
    if (editing.mode === 'evaluate') payload.evaluation = form.get('evaluation')
    if (editing.mode === 'return') payload.reviewComment = form.get('reviewComment')
    await onSave(payload)
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {formError && (
        <p role="alert" className="text-destructive">
          {formError}
        </p>
      )}
      <fieldset disabled={isPending} className="space-y-4">
        {fullForm && (
          <>
            <label className="block space-y-1 text-sm font-medium">
              クラス
              <Select
                name="classId"
                required
                defaultValue={record?.classId || nurseryClasses[0]?.id}
              >
                {nurseryClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              種別
              <Select
                value={period}
                onChange={(event) => setPeriod(event.target.value as PlanRecord['period'])}
              >
                <option value="monthly">月案</option>
                <option value="weekly">週案</option>
                <option value="daily">日案</option>
              </Select>
            </label>
          </>
        )}
        {periodForm && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              {period === 'daily' ? '実施日' : '開始日'}
              <Input
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            {period !== 'daily' && (
              <label className="space-y-1 text-sm font-medium">
                終了日
                <Input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>
            )}
          </div>
        )}
        {fullForm && (
          <>
            <label className="block space-y-1 text-sm font-medium">
              ねらい
              <Textarea name="goals" maxLength={10000} defaultValue={record?.goals} />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              活動内容
              <Textarea name="activities" maxLength={10000} defaultValue={record?.activities} />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              環境・援助
              <Textarea name="support" maxLength={10000} defaultValue={record?.support} />
            </label>
          </>
        )}
        {editing.mode === 'evaluate' && (
          <label className="block space-y-1 text-sm font-medium">
            評価・振り返り
            <Textarea
              name="evaluation"
              required
              maxLength={10000}
              defaultValue={record?.evaluation}
            />
          </label>
        )}
        {editing.mode === 'return' && (
          <label className="block space-y-1 text-sm font-medium">
            修正内容
            <Textarea name="reviewComment" required maxLength={10000} />
          </label>
        )}
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {editing.mode === 'copy'
            ? '下書きを作成'
            : editing.mode === 'return'
              ? '修正を依頼'
              : fullForm
                ? '下書きを保存'
                : '保存'}
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </form>
  )
}
