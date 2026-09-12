'use client'

import { useEffect, useState } from 'react'
import type { NapData, NapObservation, NapSession } from '@/lib/operations/nap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useOperations } from './use-operations'
import { OperationLoading } from './operation-loading'

const postureLabel = { back: '仰向け', side: '横向き', front: 'うつ伏せ' }
function time(value: string) {
  return new Date(value).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Mutate = (command: { type: string; payload: Record<string, unknown> }) => Promise<boolean>
function SessionCard({
  session,
  observations,
  now,
  isPending,
  mutate,
}: {
  session: NapSession
  observations: NapObservation[]
  now: number
  isPending: boolean
  mutate: Mutate
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [posture, setPosture] = useState('')
  const [breathing, setBreathing] = useState('')
  const [note, setNote] = useState('')
  const [response, setResponse] = useState('')
  const [responseVersion, setResponseVersion] = useState<number | null>(null)
  const [observationVersion, setObservationVersion] = useState<number | null>(null)
  const isOverdue = now >= Date.parse(session.dueAt)
  async function observe(event: React.FormEvent) {
    event.preventDefault()
    if (
      await mutate({
        type: 'observe',
        payload: { sessionId: session.id, version: observationVersion, posture, breathing, note },
      })
    ) {
      setPosture('')
      setBreathing('')
      setNote('')
      setIsOpen(false)
    }
  }
  return (
    <article
      className={`space-y-3 rounded-xl border p-4 ${session.needsResponse ? 'border-red-500 bg-red-50/50' : isOverdue ? 'border-amber-500 bg-amber-50/50' : 'border-border bg-card'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{session.childName}</h3>
          <p className="text-xs text-muted-foreground">
            {session.className} · 入眠 {time(session.startedAt)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${session.needsResponse ? 'bg-red-100 text-red-800' : isOverdue ? 'bg-amber-100 text-amber-900' : 'bg-muted'}`}
        >
          {session.needsResponse ? '要対応' : isOverdue ? '確認時刻を超過' : '午睡中'}
        </span>
      </div>
      <p className="text-sm">
        次回確認 {time(session.dueAt)}{' '}
        <span className="text-muted-foreground">（{session.intervalMinutes}分間隔）</span>
      </p>
      {session.lastObservedAt && (
        <p className="text-xs text-muted-foreground">前回確認 {time(session.lastObservedAt)}</p>
      )}
      {session.needsResponse && (
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (
              await mutate({
                type: 'respond',
                payload: { sessionId: session.id, version: responseVersion, response },
              })
            ) {
              setResponse('')
              setResponseVersion(null)
            }
          }}
          className="space-y-2 rounded-lg border border-red-200 p-3"
        >
          <p className="text-sm font-semibold text-red-800">
            未対応の呼吸確認{' '}
            {observations.filter((o) => o.breathing === 'concern' && !o.response).length}件
          </p>
          {observations
            .filter((o) => o.breathing === 'concern' && !o.response)
            .map((o) => (
              <p key={o.id} className="text-sm">
                {time(o.observedAt)} · {o.note}
              </p>
            ))}
          <label className="grid gap-1 text-sm">
            対応内容
            <Textarea
              required
              maxLength={2000}

              value={response}
              onChange={(event) => {
                setResponseVersion((version) => version ?? session.version)
                setResponse(event.target.value)
              }}
            />
          </label>
          {responseVersion !== null && responseVersion !== session.version && (
            <div role="alert" className="space-y-2 text-sm text-red-800">
              <p>入力中に午睡記録が更新されました。未対応の記録を再確認してください。</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResponseVersion(session.version)}
              >
                最新の未対応記録を確認しました
              </Button>
            </div>
          )}
          <Button
            type="submit"
            disabled={isPending || !response.trim() || responseVersion !== session.version}
          >
            未対応分への対応を記録
          </Button>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            if (!isOpen) setObservationVersion(session.version)
            setIsOpen(!isOpen)
          }}
        >
          {isOpen ? '入力を閉じる' : '姿勢・呼吸を記録'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending || session.needsResponse}
          onClick={() =>
            void mutate({
              type: 'end',
              payload: { sessionId: session.id, version: session.version },
            })
          }
        >
          午睡終了
        </Button>
      </div>
      {isOpen && (
        <form onSubmit={observe} className="space-y-3 border-t pt-3">
          {observationVersion !== session.version && (
            <div role="alert" className="space-y-2 text-sm text-red-800">
              <p>入力中に午睡記録が更新されました。確認履歴を再確認してください。</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setObservationVersion(session.version)}
              >
                最新の確認履歴を確認しました
              </Button>
            </div>
          )}
          <label className="grid gap-1 text-sm">
            姿勢
            <Select
              required

              value={posture}
              onChange={(event) => setPosture(event.target.value)}
            >
              <option value="">選択してください</option>
              <option value="back">仰向け</option>
              <option value="side">横向き</option>
              <option value="front">うつ伏せ</option>
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            呼吸
            <Select
              required

              value={breathing}
              onChange={(event) => setBreathing(event.target.value)}
            >
              <option value="">選択してください</option>
              <option value="normal">異常なし</option>
              <option value="concern">気になる点あり</option>
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            {breathing === 'concern' ? '気になる点' : '記録メモ'}
            <Textarea
              required={breathing === 'concern'}
              maxLength={2000}

              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            disabled={
              isPending ||
              observationVersion !== session.version ||
              !posture ||
              !breathing ||
              (breathing === 'concern' && !note.trim())
            }
          >
            確認を記録
          </Button>
        </form>
      )}
      <ObservationHistory observations={observations} />
    </article>
  )
}
function ObservationHistory({ observations }: { observations: NapObservation[] }) {
  if (!observations.length) return <p className="text-xs text-muted-foreground">確認記録なし</p>
  return (
    <details>
      <summary className="cursor-pointer text-sm">確認履歴（{observations.length}件）</summary>
      <ol className="mt-2 space-y-3">
        {observations.map((observation) => (
          <li key={observation.id} className="border-l-2 border-border pl-3 text-sm">
            <p>
              {time(observation.observedAt)} · {observation.observerName}
            </p>
            <p>
              {postureLabel[observation.posture]} /{' '}
              {observation.breathing === 'normal' ? '呼吸に異常なし' : '呼吸に気になる点あり'}
            </p>
            {observation.note && <p className="whitespace-pre-wrap">{observation.note}</p>}
            {observation.response && (
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                対応: {observation.response}
                <br />
                {observation.respondedAt && time(observation.respondedAt)} ·{' '}
                {observation.responderName}
              </p>
            )}
          </li>
        ))}
      </ol>
    </details>
  )
}

export function NapPanel() {
  const { data, error, isLoading, isPending, mutate, refresh } = useOperations<NapData>('nap')
  const [classId, setClassId] = useState('')
  const [childId, setChildId] = useState('')
  const [intervalMinutes, setIntervalMinutes] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])
  if (isLoading) return <OperationLoading label="午睡チェック" />
  if (!data)
    return (
      <div className="space-y-3">
        <p role="alert">{error || '午睡記録を読み込めませんでした'}</p>
        <Button onClick={() => void refresh()}>再読み込み</Button>
      </div>
    )
  const activeSessions = data?.sessions.filter((session) => !session.endedAt) ?? []
  const visibleSessions = activeSessions
    .filter((session) => !classId || session.classId === classId)
    .sort(
      (a, b) =>
        Number(b.needsResponse) - Number(a.needsResponse) ||
        Date.parse(a.dueAt) - Date.parse(b.dueAt),
    )
  const availableChildren =
    data?.children.filter(
      (child) =>
        (!classId || child.classId === classId) &&
        !activeSessions.some((session) => session.childId === child.id),
    ) ?? []
  const classes = Array.from(
    new Map(
      data?.children
        .filter((child) => child.classId)
        .map((child) => [child.classId!, child.className!]),
    ).entries(),
  )
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">午睡状況</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            午睡中 {activeSessions.length}人 · 要対応{' '}
            {activeSessions.filter((session) => session.needsResponse).length}人 · 確認時刻超過{' '}
            {activeSessions.filter((session) => now >= Date.parse(session.dueAt)).length}人
          </p>
        </div>
        <Button type="button" onClick={() => void refresh()}>
          更新
        </Button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <label className="grid max-w-xs gap-1 text-sm">
        クラス
        <Select
          value={classId}
          onChange={(event) => {
            setClassId(event.target.value)
            setChildId('')
          }}
        >
          <option value="">全クラス</option>
          {classes.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
      </label>
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
        onSubmit={async (event) => {
          event.preventDefault()
          if (
            await mutate({
              type: 'start',
              payload: { childId, intervalMinutes: Number(intervalMinutes) },
            })
          )
            setChildId('')
        }}
      >
        <label className="grid gap-1 text-sm">
          園児
          <Select required value={childId} onChange={(event) => setChildId(event.target.value)}>
            <option value="">園児を選択</option>
            {availableChildren.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          園で定めた確認間隔（分）
          <Input
            className="w-44"
            required
            type="number"
            min={1}
            max={120}
            value={intervalMinutes}
            onChange={(event) => setIntervalMinutes(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={isPending || !childId || !intervalMinutes}>
          入眠を記録
        </Button>
      </form>
      {!isLoading && !visibleSessions.length && (
        <p className="rounded-lg bg-muted p-4 text-sm">午睡中の園児はいません。</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {visibleSessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            observations={
              data?.observations.filter((observation) => observation.sessionId === session.id) ?? []
            }
            now={now}
            isPending={isPending}
            mutate={mutate}
          />
        ))}
      </div>
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer font-semibold">終了した午睡（直近7日）</summary>
        <div className="mt-4 space-y-4">
          {data?.sessions
            .filter((session) => session.endedAt && (!classId || session.classId === classId))
            .map((session) => (
              <article key={session.id} className="space-y-2 border-t pt-3">
                <h3 className="text-sm font-semibold">
                  {session.childName} · {time(session.startedAt)} 〜 {time(session.endedAt!)}
                </h3>
                <ObservationHistory
                  observations={data.observations.filter(
                    (observation) => observation.sessionId === session.id,
                  )}
                />
              </article>
            ))}
        </div>
      </details>
    </section>
  )
}
