import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { User } from '@/lib/types'
import type { OperationDatabase } from './shared'

const correctionSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    clockIn: z.iso.datetime({ offset: true }),
    clockOut: z.iso.datetime({ offset: true }),
    breakMinutes: z.number().min(0),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict()
  .refine(
    (p) =>
      Date.parse(p.clockOut) >= Date.parse(p.clockIn) &&
      p.breakMinutes * 60000 <= Date.parse(p.clockOut) - Date.parse(p.clockIn) &&
      Date.parse(p.clockOut) <= Date.now(),
  )
const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('clock_in'),
      payload: z.object({}).strict().default({}),
    })
    .strict(),
  z
    .object({
      type: z.enum(['break_start', 'break_end', 'clock_out']),
      payload: z
        .object({ sessionId: z.string().min(1), version: z.number().int().positive() })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal('correct'), payload: correctionSchema }).strict(),
])
interface SessionRow {
  id: string
  user_id: string
  name: string
  clock_in: Date | string
  clock_out: Date | string | null
  break_started_at: Date | string | null
  break_minutes: number
  version: number
}
const iso = (value: Date | string) => new Date(value).toISOString()
const mapSession = (row: SessionRow) => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  clockIn: iso(row.clock_in),
  clockOut: row.clock_out ? iso(row.clock_out) : null,
  breakStartedAt: row.break_started_at ? iso(row.break_started_at) : null,
  breakMinutes: row.break_minutes,
  version: row.version,
  workMinutes: row.clock_out
    ? Math.max(
        0,
        (Date.parse(iso(row.clock_out)) - Date.parse(iso(row.clock_in))) / 60000 -
          row.break_minutes,
      )
    : null,
})
export async function readAttendance(db: OperationDatabase, user: User) {
  if (user.role !== 'teacher') throw new Error('Forbidden')
  // Use the database clock for both filtering and the month label, including at midnight.
  const calendar = await db.query<{ month: string }>(
    `SELECT to_char(now() AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM') AS month`,
  )
  const month = calendar.rows[0].month
  const { rows } = await db.query<SessionRow>(
    `SELECT s.*, u.name FROM staff_attendance_session s JOIN app_user u ON u.id=s.user_id
 WHERE s.facility_id=$1 AND ($2::boolean OR s.user_id=$3)
 AND (s.clock_out IS NULL OR s.clock_in >= date_trunc('month', now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo') ORDER BY s.clock_in DESC`,
    [user.facilityId, !!user.canManageFacility, user.id],
  )
  const sessions = rows.map(mapSession)
  const summary = new Map<
    string,
    {
      userId: string
      name: string
      workMinutes: number
      breakMinutes: number
      sessionCount: number
    }
  >()
  for (const session of sessions) {
    if (
      !session.clockOut ||
      new Date(session.clockIn)
        .toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
        .slice(0, 7) !== month
    )
      continue
    const item = summary.get(session.userId) ?? {
      userId: session.userId,
      name: session.name,
      workMinutes: 0,
      breakMinutes: 0,
      sessionCount: 0,
    }
    item.workMinutes += session.workMinutes ?? 0
    item.breakMinutes += session.breakMinutes
    item.sessionCount++
    summary.set(session.userId, item)
  }
  return {
    month,
    canManage: !!user.canManageFacility,
    currentSession: sessions.find((s) => s.userId === user.id && !s.clockOut) ?? null,
    sessions,
    summaries: [...summary.values()],
  }
}
export async function mutateAttendance(db: OperationDatabase, user: User, input: unknown) {
  if (user.role !== 'teacher') throw new Error('Forbidden')
  const parsed = commandSchema.safeParse(input)
  if (!parsed.success) throw new Error('InvalidInput')
  const command = parsed.data
  if (command.type === 'correct') {
    if (!user.canManageFacility) throw new Error('Forbidden')
    const p = command.payload
    const target = await db.query<{ user_id: string }>(
      'SELECT user_id FROM staff_attendance_session WHERE id=$1 AND facility_id=$2',
      [p.id, user.facilityId],
    )
    if (!target.rows[0]) throw new Error('Conflict')
    await db.query('SELECT id FROM app_user WHERE id=$1 FOR NO KEY UPDATE', [
      target.rows[0].user_id,
    ])
    const { rows } = await db.query<SessionRow>(
      'SELECT * FROM staff_attendance_session WHERE id=$1 AND facility_id=$2 FOR UPDATE',
      [p.id, user.facilityId],
    )
    const session = rows[0]
    if (!session || !session.clock_out || session.version !== p.version) throw new Error('Conflict')
    const overlap = await db.query(
      `SELECT id FROM staff_attendance_session WHERE facility_id=$1 AND user_id=$2 AND id<>$3 AND clock_in < $5::timestamptz AND (clock_out IS NULL OR clock_out > $4::timestamptz)`,
      [user.facilityId, session.user_id, p.id, p.clockIn, p.clockOut],
    )
    if (overlap.rows.length) throw new Error('Conflict')
    await db.query(
      'UPDATE staff_attendance_session SET clock_in=$1, clock_out=$2, break_minutes=$3, version=version+1 WHERE id=$4',
      [p.clockIn, p.clockOut, p.breakMinutes, p.id],
    )
    await db.query(
      'INSERT INTO staff_attendance_correction (id,session_id,actor_id,reason,previous_data,corrected_data) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
      [randomUUID(), p.id, user.id, p.reason, JSON.stringify(session), JSON.stringify(p)],
    )
    return { id: p.id }
  }
  // Lock a stable row even before a first session exists. Callers must wrap this in a transaction.
  await db.query('SELECT id FROM app_user WHERE id=$1 FOR NO KEY UPDATE', [user.id])
  const { rows } = await db.query<SessionRow>(
    'SELECT * FROM staff_attendance_session WHERE facility_id=$1 AND user_id=$2 AND clock_out IS NULL FOR UPDATE',
    [user.facilityId, user.id],
  )
  const session = rows[0]
  if (command.type === 'clock_in') {
    if (session) throw new Error('Conflict')
    const id = randomUUID()
    await db.query(
      'INSERT INTO staff_attendance_session (id,facility_id,user_id,clock_in) VALUES ($1,$2,$3,clock_timestamp())',
      [id, user.facilityId, user.id],
    )
    return { id }
  }
  if (
    !session ||
    session.id !== command.payload.sessionId ||
    session.version !== command.payload.version
  )
    throw new Error('Conflict')
  if (command.type === 'break_start') {
    if (session.break_started_at) throw new Error('Conflict')
    await db.query(
      'UPDATE staff_attendance_session SET break_started_at=clock_timestamp(),version=version+1 WHERE id=$1',
      [session.id],
    )
  } else if (command.type === 'break_end') {
    if (!session.break_started_at) throw new Error('Conflict')
    await db.query(
      'UPDATE staff_attendance_session SET break_minutes=break_minutes+EXTRACT(EPOCH FROM (clock_timestamp()-break_started_at))/60,break_started_at=NULL,version=version+1 WHERE id=$1',
      [session.id],
    )
  } else {
    if (session.break_started_at) throw new Error('Conflict')
    await db.query(
      'UPDATE staff_attendance_session SET clock_out=clock_timestamp(),version=version+1 WHERE id=$1',
      [session.id],
    )
  }
  return { id: session.id }
}
