'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useStore } from '@/lib/store'
import type { RiskRecord } from '@/lib/operations/risk-plans'
import { OperationLoading } from './operation-loading'
import { useOperations } from './use-operations'

const kindLabel = { accident: '事故', near_miss: 'ヒヤリハット' }
const severityLabel = { low: '低', medium: '中', high: '高' }
const localTime = (value: string | Date) =>
  new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 16)
const displayTime = (value: string) =>
  new Date(value).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export function RiskPanel() {
  const { children, members } = useStore()
  const { data, error, isLoading, isPending, mutate, refresh } =
    useOperations<RiskRecord[]>('risks')
  const [editing, setEditing] = useState<RiskRecord | 'new' | null>(null)
  const [status, setStatus] = useState('open')
  const [kind, setKind] = useState('all')
  const [notice, setNotice] = useState('')
  if (isLoading) return <OperationLoading label="リスク管理" />
  if (!data)
    return (
      <div>
        <p role="alert">{error || '報告を読み込めませんでした'}</p>
        <Button onClick={refresh}>再読み込み</Button>
      </div>
    )
  const records = data.filter(
    (item) =>
      (status === 'all' || item.status === status) && (kind === 'all' || item.kind === kind),
  )
  async function change(record: RiskRecord, type: 'resolve' | 'reopen') {
    if (await mutate({ type, payload: { id: record.id, version: record.version } }))
      setNotice(type === 'resolve' ? '対応を完了しました' : '対応を再開しました')
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
          対応中 {data.filter((item) => item.status === 'open').length}件 ・ 重大度 高{' '}
          {data.filter((item) => item.status === 'open' && item.severity === 'high').length}件
        </p>
        <Button
          size="lg"
          disabled={isPending || editing !== null}
          onClick={() => {
            setNotice('')
            setEditing('new')
          }}
        >
          報告を記録
        </Button>
      </div>
      {editing !== null && (
        <RiskEditor
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? undefined : editing}
          isPending={isPending}
          onCancel={() => setEditing(null)}
          onSave={async (payload) => {
            const saved = await mutate({ type: editing === 'new' ? 'create' : 'update', payload })
            if (saved) {
              setEditing(null)
              setNotice('報告を保存しました')
            }
          }}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          対応状況
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="open">対応中</option>
            <option value="resolved">対応完了</option>
            <option value="all">すべて</option>
          </Select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          報告区分
          <Select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">すべて</option>
            <option value="accident">事故</option>
            <option value="near_miss">ヒヤリハット</option>
          </Select>
        </label>
      </div>
      {records.length === 0 && (
        <p className="py-6 text-muted-foreground">該当する報告はありません</p>
      )}
      {records.map((record) => (
        <article key={record.id} className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">
              {kindLabel[record.kind]} ・{' '}
              {record.childId
                ? children.find((child) => child.id === record.childId)?.name || '園児'
                : '施設全体'}
            </h2>
            <span
              className={record.severity === 'high' ? 'font-semibold text-destructive' : 'text-sm'}
            >
              重大度 {severityLabel[record.severity]} ・{' '}
              {record.status === 'open' ? '対応中' : '対応完了'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {displayTime(record.occurredAt)} ・ 記録者{' '}
            {members.find((member) => member.id === record.authorId)?.name || '職員'}
          </p>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium">発生状況</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">{record.detail}</dd>
            </div>
            <div>
              <dt className="font-medium">対応</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                {record.response || '未記入'}
              </dd>
            </div>
            <div>
              <dt className="font-medium">再発防止</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                {record.prevention || '未記入'}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {record.status === 'open' ? (
              <>
                <Button
                  variant="outline"
                  disabled={isPending || editing !== null}
                  onClick={() => {
                    setNotice('')
                    setEditing(record)
                  }}
                >
                  編集
                </Button>
                <Button
                  disabled={
                    isPending ||
                    editing !== null ||
                    !record.response.trim() ||
                    !record.prevention.trim()
                  }
                  onClick={() => change(record, 'resolve')}
                >
                  対応を完了
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                disabled={isPending || editing !== null}
                onClick={() => change(record, 'reopen')}
              >
                対応を再開
              </Button>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

function RiskEditor({
  initial,
  isPending,
  onCancel,
  onSave,
}: {
  initial?: RiskRecord
  isPending: boolean
  onCancel: () => void
  onSave: (payload: unknown) => Promise<void>
}) {
  const { children } = useStore()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await onSave({
      ...(initial ? { id: initial.id, version: initial.version } : {}),
      occurredAt: new Date(`${form.get('occurredAt')}:00+09:00`).toISOString(),
      kind: form.get('kind'),
      severity: form.get('severity'),
      childId: form.get('childId') || null,
      detail: form.get('detail'),
      response: form.get('response'),
      prevention: form.get('prevention'),
    })
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-bold">{initial ? '報告を編集' : '新しい報告'}</h2>
      <fieldset disabled={isPending} className="space-y-4">
        <label className="block space-y-1 text-sm font-medium">
          発生日時
          <Input
            name="occurredAt"
            type="datetime-local"
            required
            defaultValue={localTime(initial?.occurredAt || new Date())}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            区分
            <Select name="kind" defaultValue={initial?.kind || 'near_miss'}>
              <option value="near_miss">ヒヤリハット</option>
              <option value="accident">事故</option>
            </Select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            重大度
            <Select name="severity" defaultValue={initial?.severity || 'low'}>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </Select>
          </label>
        </div>
        <label className="block space-y-1 text-sm font-medium">
          対象
          <Select name="childId" defaultValue={initial?.childId || ''}>
            <option value="">施設全体</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.className} ・ {child.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block space-y-1 text-sm font-medium">
          発生状況
          <Textarea name="detail" required maxLength={10000} defaultValue={initial?.detail} />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          対応
          <Textarea name="response" maxLength={10000} defaultValue={initial?.response} />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          再発防止
          <Textarea name="prevention" maxLength={10000} defaultValue={initial?.prevention} />
        </label>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          保存
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </form>
  )
}
