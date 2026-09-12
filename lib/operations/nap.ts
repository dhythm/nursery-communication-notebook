import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { User } from '@/lib/types'
import type { OperationDatabase } from './shared'

const identity = { sessionId: z.string().min(1), version: z.number().int().positive() }
const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    payload: z.object({
      childId: z.string().min(1),
      intervalMinutes: z.number().int().min(1).max(120),
    }),
  }),
  z.object({
    type: z.literal('observe'),
    payload: z
      .object({
        ...identity,
        posture: z.enum(['back', 'side', 'front']),
        breathing: z.enum(['normal', 'concern']),
        note: z.string().trim().max(2000).default(''),
      })
      .refine((p) => p.breathing !== 'concern' || p.note.length > 0),
  }),
  z.object({
    type: z.literal('respond'),
    payload: z.object({ ...identity, response: z.string().trim().min(1).max(2000) }),
  }),
  z.object({ type: z.literal('end'), payload: z.object(identity) }),
])
export interface NapSession {
  id: string
  childId: string
  childName: string
  classId: string | null
  className: string | null
  startedAt: string
  endedAt: string | null
  intervalMinutes: number
  dueAt: string
  lastObservedAt: string | null
  needsResponse: boolean
  version: number
}
export interface NapObservation {
  id: string
  sessionId: string
  observedAt: string
  observerName: string
  posture: 'back' | 'side' | 'front'
  breathing: 'normal' | 'concern'
  note: string
  response: string | null
  respondedAt: string | null
  responderName: string | null
}
export interface NapData {
  children: { id: string; name: string; classId: string | null; className: string | null }[]
  sessions: NapSession[]
  observations: NapObservation[]
}
export async function readNap(db: OperationDatabase, user: User): Promise<NapData> {
  if (user.role !== 'teacher') throw new Error('Forbidden')
  const children = await db.query<NapData['children'][number]>(
    `SELECT c.id,c.name,cl.id AS "classId",cl.name AS "className" FROM child c
    LEFT JOIN child_enrollment e ON e.child_id=c.id AND e.ended_on IS NULL AND (e.started_on IS NULL OR e.started_on <= (now() AT TIME ZONE 'Asia/Tokyo')::date)
    LEFT JOIN nursery_class cl ON cl.id=e.class_id AND cl.facility_id=c.facility_id
    WHERE c.facility_id=$1 AND (c.admitted_on IS NULL OR c.admitted_on <= (now() AT TIME ZONE 'Asia/Tokyo')::date) AND (c.withdrawn_on IS NULL OR c.withdrawn_on > (now() AT TIME ZONE 'Asia/Tokyo')::date) ORDER BY cl.name,c.name`,
    [user.facilityId],
  )
  const sessions = await db.query<NapSession>(
    `SELECT s.id,s.child_id AS "childId",c.name AS "childName",cl.id AS "classId",cl.name AS "className",
    s.started_at AS "startedAt",s.ended_at AS "endedAt",s.interval_minutes AS "intervalMinutes",s.due_at AS "dueAt",s.last_observed_at AS "lastObservedAt",s.needs_response AS "needsResponse",s.version
    FROM nap_session s JOIN child c ON c.id=s.child_id
    LEFT JOIN child_enrollment e ON e.child_id=c.id AND e.ended_on IS NULL AND (e.started_on IS NULL OR e.started_on <= (now() AT TIME ZONE 'Asia/Tokyo')::date)
    LEFT JOIN nursery_class cl ON cl.id=e.class_id AND cl.facility_id=c.facility_id
    WHERE s.facility_id=$1 AND (s.ended_at IS NULL OR s.ended_at >= now()-interval '7 days') ORDER BY s.started_at DESC`,
    [user.facilityId],
  )
  const observations = await db.query<NapObservation>(
    `SELECT o.id,o.session_id AS "sessionId",o.observed_at AS "observedAt",u.name AS "observerName",o.posture,o.breathing,o.note,o.response,o.responded_at AS "respondedAt",r.name AS "responderName"
    FROM nap_observation o JOIN nap_session s ON s.id=o.session_id JOIN app_user u ON u.id=o.observer_id LEFT JOIN app_user r ON r.id=o.responder_id
    WHERE o.facility_id=$1 AND (s.ended_at IS NULL OR s.ended_at >= now()-interval '7 days') ORDER BY o.observed_at DESC,o.id`,
    [user.facilityId],
  )
  // PostgreSQL and PGlite return Date objects; the public shape is JSON serializable.
  return JSON.parse(
    JSON.stringify({
      children: children.rows,
      sessions: sessions.rows,
      observations: observations.rows,
    }),
  ) as NapData
}
export async function mutateNap(db: OperationDatabase, user: User, input: unknown) {
  if (user.role !== 'teacher') throw new Error('Forbidden')
  const parsed = commandSchema.safeParse(input)
  if (!parsed.success) throw new Error('InvalidInput')
  const command = parsed.data
  if (command.type === 'start') {
    const p = command.payload
    const child = await db.query(
      `SELECT id FROM child WHERE id=$1 AND facility_id=$2
      AND (admitted_on IS NULL OR admitted_on <= (now() AT TIME ZONE 'Asia/Tokyo')::date)
      AND (withdrawn_on IS NULL OR withdrawn_on > (now() AT TIME ZONE 'Asia/Tokyo')::date) FOR UPDATE`,
      [p.childId, user.facilityId],
    )
    if (!child.rows.length) throw new Error('Forbidden')
    const active = await db.query(
      'SELECT id FROM nap_session WHERE child_id=$1 AND ended_at IS NULL',
      [p.childId],
    )
    if (active.rows.length) throw new Error('Conflict')
    const id = randomUUID()
    await db.query(
      `INSERT INTO nap_session (id,facility_id,child_id,started_by,interval_minutes,due_at)
      VALUES ($1,$2,$3,$4,$5,now()+$5::integer * interval '1 minute')`,
      [id, user.facilityId, p.childId, user.id, p.intervalMinutes],
    )
    return { id }
  }
  const p = command.payload
  const result = await db.query<{
    id: string
    version: number
    ended_at: unknown
    needs_response: boolean
  }>(
    `SELECT id,version,ended_at,needs_response FROM nap_session WHERE id=$1 AND facility_id=$2 FOR UPDATE`,
    [p.sessionId, user.facilityId],
  )
  const session = result.rows[0]
  if (!session) throw new Error('Forbidden')
  if (session.version !== p.version || session.ended_at) throw new Error('Conflict')
  if (command.type === 'observe') {
    const observation = command.payload
    await db.query(
      `INSERT INTO nap_observation (id,facility_id,session_id,observer_id,posture,breathing,note) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        randomUUID(),
        user.facilityId,
        session.id,
        user.id,
        observation.posture,
        observation.breathing,
        observation.note,
      ],
    )
    await db.query(
      `UPDATE nap_session SET last_observed_at=now(),due_at=now()+interval_minutes*interval '1 minute',needs_response=needs_response OR $2,version=version+1 WHERE id=$1`,
      [session.id, observation.breathing === 'concern'],
    )
  } else if (command.type === 'respond') {
    if (!session.needs_response) throw new Error('Conflict')
    await db.query(
      `UPDATE nap_observation SET response=$3,responded_at=now(),responder_id=$4 WHERE session_id=$1 AND facility_id=$2 AND breathing='concern' AND response IS NULL`,
      [session.id, user.facilityId, command.payload.response, user.id],
    )
    await db.query('UPDATE nap_session SET needs_response=false,version=version+1 WHERE id=$1', [
      session.id,
    ])
  } else {
    if (session.needs_response) throw new Error('Conflict')
    await db.query(
      'UPDATE nap_session SET ended_at=now(),ended_by=$2,version=version+1 WHERE id=$1',
      [session.id, user.id],
    )
  }
  return { id: session.id }
}
