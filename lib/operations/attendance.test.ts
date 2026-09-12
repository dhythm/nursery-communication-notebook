import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { attendanceMigrationSql } from './attendance-schema'
import { mutateAttendance, readAttendance } from './attendance'
import { correctionTimestamp } from '@/components/operations/attendance-panel'
import type { User } from '@/lib/types'

const teacher: User = {
  id: 't1',
  name: '先生',
  email: 't@example.com',
  role: 'teacher',
  facilityId: 'f1',
  facilitySlug: 'demo',
}
let db: PGlite
const command = async (type: string, payload?: Record<string, unknown>) => {
  let commandPayload = payload
  if (!commandPayload && ['break_start', 'break_end', 'clock_out'].includes(type)) {
    const session = (await readAttendance(db, teacher)).currentSession
    commandPayload = { sessionId: session?.id ?? 'missing', version: session?.version ?? 1 }
  }
  return db.transaction((tx) =>
    mutateAttendance(tx, teacher, { type, payload: commandPayload ?? {} }),
  )
}
beforeEach(async () => {
  db = new PGlite()
  await db.exec(
    `CREATE TABLE facility(id text PRIMARY KEY); CREATE TABLE app_user(id text PRIMARY KEY, name text); INSERT INTO facility VALUES ('f1'),('f2'); INSERT INTO app_user VALUES ('t1','先生'),('t2','別の先生');`,
  )
  await db.exec(attendanceMigrationSql)
})
afterEach(async () => db.close())
describe('attendance', () => {
  it('records only valid transitions and prevents a second open session', async () => {
    await expect(command('break_start')).rejects.toThrow('Conflict')
    await command('clock_in')
    await expect(command('clock_in')).rejects.toThrow('Conflict')
    await command('break_start')
    await expect(command('clock_out')).rejects.toThrow('Conflict')
    await command('break_end')
    await command('clock_out')
    const data = await readAttendance(db, teacher)
    expect(data.currentSession).toBeNull()
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0].clockOut).toBeTruthy()
  })
  it('keeps staff and facility history isolated', async () => {
    await command('clock_in')
    expect((await readAttendance(db, { ...teacher, id: 't2' })).sessions).toHaveLength(0)
    expect(
      (await readAttendance(db, { ...teacher, id: 't2', canManageFacility: true })).sessions,
    ).toHaveLength(1)
    expect(
      (await readAttendance(db, { ...teacher, facilityId: 'f2', canManageFacility: true }))
        .sessions,
    ).toHaveLength(0)
    await expect(readAttendance(db, { ...teacher, role: 'parent' })).rejects.toThrow('Forbidden')
  })
  it('requires manager permission, reason, and optimistic version for a correction', async () => {
    await command('clock_in')
    await command('clock_out')
    const session = (await readAttendance(db, teacher)).sessions[0]
    const payload = {
      id: session.id,
      version: session.version,
      clockIn: '2026-01-01T00:00:00.000Z',
      clockOut: '2026-01-01T09:00:00.000Z',
      breakMinutes: 60,
      reason: '打刻漏れを本人と確認',
    }
    await expect(command('correct', payload)).rejects.toThrow('Forbidden')
    await db.transaction((tx) =>
      mutateAttendance(tx, { ...teacher, canManageFacility: true }, { type: 'correct', payload }),
    )
    await expect(
      db.transaction((tx) =>
        mutateAttendance(tx, { ...teacher, canManageFacility: true }, { type: 'correct', payload }),
      ),
    ).rejects.toThrow('Conflict')
    const { rows } = await db.query<{ break_minutes: number }>(
      'SELECT break_minutes FROM staff_attendance_session',
    )
    expect(rows[0].break_minutes).toBe(60)
    expect((await db.query('SELECT * FROM staff_attendance_correction')).rows).toHaveLength(1)
  })
  it('rejects client-controlled timestamps for punches and invalid correction totals', async () => {
    await expect(command('clock_in', { clockIn: '2000-01-01' })).rejects.toThrow('InvalidInput')
    await expect(
      command('correct', {
        id: 'x',
        version: 1,
        clockIn: '2026-01-01T00:00:00Z',
        clockOut: '2026-01-01T01:00:00Z',
        breakMinutes: 120,
        reason: '修正',
      }),
    ).rejects.toThrow('InvalidInput')
  })
})

it('calculates overnight work without counting break time twice', async () => {
  const month = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
  const now = new Date(`${month}-02T08:00:00+09:00`)
  const start = new Date(`${month}-01T23:00:00+09:00`)
  await db.query(
    `INSERT INTO staff_attendance_session (id,facility_id,user_id,clock_in,clock_out,break_minutes) VALUES ('overnight','f1','t1',$1,$2,60)`,
    [start.toISOString(), now.toISOString()],
  )
  const data = await readAttendance(db, teacher)
  expect(data.sessions[0].workMinutes).toBe(480)
  expect(data.summaries[0]).toMatchObject({ workMinutes: 480, breakMinutes: 60, sessionCount: 1 })
})

it('keeps a prior-month open session visible without adding it to completed totals', async () => {
  await db.query(
    `INSERT INTO staff_attendance_session (id,facility_id,user_id,clock_in) VALUES ('prior','f1','t1',date_trunc('month',now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo' - interval '1 minute')`,
  )
  const data = await readAttendance(db, teacher)
  expect(data.currentSession?.id).toBe('prior')
  expect(data.summaries).toEqual([])
  await expect(command('clock_in')).rejects.toThrow('Conflict')
})

it('rejects cross-facility correction targets and overlapping sessions', async () => {
  await db.query(
    `INSERT INTO staff_attendance_session (id,facility_id,user_id,clock_in,clock_out) VALUES ('a','f1','t1','2020-01-01T00:00Z','2020-01-01T09:00Z'),('b','f1','t1','2020-01-02T00:00Z','2020-01-02T09:00Z')`,
  )
  const payload = {
    id: 'a',
    version: 1,
    clockIn: '2020-01-01T00:00:00Z',
    clockOut: '2020-01-02T01:00:00Z',
    breakMinutes: 60,
    reason: '本人確認',
  }
  const manager = { ...teacher, canManageFacility: true }
  await expect(
    db.transaction((tx) => mutateAttendance(tx, manager, { type: 'correct', payload })),
  ).rejects.toThrow('Conflict')
  await expect(
    db.transaction((tx) =>
      mutateAttendance(tx, { ...manager, facilityId: 'f2' }, { type: 'correct', payload }),
    ),
  ).rejects.toThrow('Conflict')
  await expect(
    db.transaction((tx) =>
      mutateAttendance(tx, manager, { type: 'correct', payload: { ...payload, reason: ' ' } }),
    ),
  ).rejects.toThrow('InvalidInput')
  expect((await db.query('SELECT * FROM staff_attendance_correction')).rows).toHaveLength(0)
})

it('accumulates multiple breaks and uses their total once at clock-out', async () => {
  await command('clock_in')
  await db.query(
    `UPDATE staff_attendance_session SET clock_in=clock_timestamp()-interval '90 minutes'`,
  )
  for (const minute of [15, 10]) {
    await command('break_start')
    await db.query(
      `UPDATE staff_attendance_session SET break_started_at=clock_timestamp()-($1::double precision * interval '1 minute')`,
      [minute],
    )
    await command('break_end')
  }
  await command('clock_out')
  const session = (await readAttendance(db, teacher)).sessions[0]
  expect(session.breakMinutes).toBeCloseTo(25, 1)
  expect(session.workMinutes).toBeCloseTo(65, 1)
})

it('rejects stale session/version actions without changing a newer session', async () => {
  await command('clock_in')
  const first = (await readAttendance(db, teacher)).currentSession!
  await command('break_start')
  await expect(
    command('break_end', { sessionId: first.id, version: first.version }),
  ).rejects.toThrow('Conflict')
  await command('break_end')
  await command('clock_out')
  await command('clock_in')
  const second = (await readAttendance(db, teacher)).currentSession!
  await expect(
    command('clock_out', { sessionId: first.id, version: second.version }),
  ).rejects.toThrow('Conflict')
  expect((await readAttendance(db, teacher)).currentSession?.id).toBe(second.id)
  await expect(command('clock_out', {})).rejects.toThrow('InvalidInput')
})

it('preserves exact original seconds when only another correction field changes', () => {
  const original = '2026-01-01T00:00:37.456Z'
  expect(correctionTimestamp('2026-01-01T09:00', original).toISOString()).toBe(original)
  expect(correctionTimestamp('2026-01-01T09:01', original).toISOString()).toBe(
    '2026-01-01T00:01:00.000Z',
  )
})
