'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOperations } from './use-operations'
import type { readAttendance } from '@/lib/operations/attendance'

type AttendanceData = Awaited<ReturnType<typeof readAttendance>>
type Session = AttendanceData['sessions'][number]
const dateTime = (value: string) =>
  new Date(value).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
const duration = (minute: number) => `${Math.floor(minute / 60)}時間${Math.floor(minute % 60)}分`
const localTime = (value: string) =>
  new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16)

export function correctionTimestamp(value: string, original: string): Date {
  return new Date(value === localTime(original) ? original : `${value}:00+09:00`)
}

export function AttendancePanel() {
  const { data, error, isLoading, isPending, mutate, refresh } =
    useOperations<AttendanceData>('attendance')
  const [editing, setEditing] = useState<Session | null>(null)
  const [formError, setFormError] = useState('')
  if (isLoading) return <p role="status">勤怠を読み込み中…</p>
  if (!data)
    return (
      <div>
        <p role="alert">{error || '勤怠を読み込めませんでした'}</p>
        <Button onClick={refresh}>再読み込み</Button>
      </div>
    )
  const current = data.currentSession
  const state = current ? (current.breakStartedAt ? '休憩中' : '勤務中') : '未出勤'
  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="text-lg font-bold">自分の打刻</h2>
        <p role="status" className="font-semibold">
          {state}
          {current && ` ・ ${dateTime(current.clockIn)} 出勤`}
        </p>
        <div className="flex flex-wrap gap-3">
          {!current && (
            <Button
              size="lg"
              disabled={isPending}
              onClick={() => mutate({ type: 'clock_in', payload: {} })}
            >
              出勤
            </Button>
          )}
          {current && !current.breakStartedAt && (
            <>
              <Button
                size="lg"
                disabled={isPending}
                onClick={() =>
                  mutate({
                    type: 'break_start',
                    payload: { sessionId: current.id, version: current.version },
                  })
                }
              >
                休憩開始
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  mutate({
                    type: 'clock_out',
                    payload: { sessionId: current.id, version: current.version },
                  })
                }
              >
                退勤
              </Button>
            </>
          )}
          {current?.breakStartedAt && (
            <Button
              size="lg"
              disabled={isPending}
              onClick={() =>
                mutate({
                  type: 'break_end',
                  payload: { sessionId: current.id, version: current.version },
                })
              }
            >
              休憩終了
            </Button>
          )}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">{data.month} の集計</h2>
        <p className="text-sm text-muted-foreground">出勤月で集計・退勤済みの記録</p>
        {!data.summaries.length && <p>退勤済みの記録はありません。</p>}
        {data.summaries.map((item) => (
          <div key={item.userId} className="rounded-xl border p-4">
            <p className="font-semibold">{item.name}</p>
            <p>
              {item.sessionCount}回 ・ 勤務 {duration(item.workMinutes)} ・ 休憩{' '}
              {duration(item.breakMinutes)}
            </p>
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">今月の記録・勤務中</h2>
        {!data.sessions.length && <p>打刻記録はありません。</p>}
        {data.sessions.map((session) => (
          <article key={session.id} className="rounded-xl border p-4 space-y-2">
            <p className="font-semibold">{session.name}</p>
            <p>
              {dateTime(session.clockIn)} 〜{' '}
              {session.clockOut
                ? dateTime(session.clockOut)
                : session.breakStartedAt
                  ? '休憩中'
                  : '勤務中'}
            </p>
            {session.workMinutes !== null && (
              <p>
                勤務 {duration(session.workMinutes)} ・ 休憩 {duration(session.breakMinutes)}
              </p>
            )}
            {data.canManage && session.clockOut && (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setEditing(session)
                  setFormError('')
                }}
              >
                打刻を修正
              </Button>
            )}
          </article>
        ))}
      </section>
      {editing && (
        <section className="rounded-2xl border p-5">
          <h2 className="text-lg font-bold">{editing.name}の打刻修正</h2>
          <form
            key={`${editing.id}-${editing.version}`}
            className="mt-4 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const clockIn = correctionTimestamp(String(form.get('clockIn')), editing.clockIn)
              const clockOut = correctionTimestamp(String(form.get('clockOut')), editing.clockOut!)
              if (!Number.isFinite(clockIn.getTime()) || !Number.isFinite(clockOut.getTime())) {
                setFormError('日時を確認してください')
                return
              }
              const ok = await mutate({
                type: 'correct',
                payload: {
                  id: editing.id,
                  version: editing.version,
                  clockIn: clockIn.toISOString(),
                  clockOut: clockOut.toISOString(),
                  breakMinutes: Number(form.get('breakMinutes')),
                  reason: String(form.get('reason')),
                },
              })
              if (ok) setEditing(null)
            }}
          >
            <label className="block">
              出勤日時（日本時間）
              <Input
                type="datetime-local"
                name="clockIn"
                required
                defaultValue={localTime(editing.clockIn)}
              />
            </label>
            <label className="block">
              退勤日時（日本時間）
              <Input
                type="datetime-local"
                name="clockOut"
                required
                defaultValue={localTime(editing.clockOut!)}
              />
            </label>
            <label className="block">
              休憩時間（分）
              <Input
                type="number"
                name="breakMinutes"
                min="0"
                required
                step="any"
                defaultValue={editing.breakMinutes}
              />
            </label>
            <label className="block">
              修正理由
              <Input name="reason" required maxLength={1000} />
            </label>
            {formError && <p role="alert">{formError}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                修正を保存
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setEditing(null)}
              >
                キャンセル
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
