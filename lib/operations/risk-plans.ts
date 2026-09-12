import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { User } from '@/lib/types'
import type { OperationDatabase } from './shared'

const note = z.string().trim().max(10000)
const identifier = z.string().min(1).max(200)
const reference = { id: identifier, version: z.number().int().positive() }
const date = z.iso.date()
const riskField = z.object({
  occurredAt: z.iso.datetime({ offset: true }),
  kind: z.enum(['accident', 'near_miss']),
  severity: z.enum(['low', 'medium', 'high']),
  childId: identifier.nullable().default(null),
  detail: note.min(1),
  response: note.default(''),
  prevention: note.default(''),
})
const riskCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create'), payload: riskField }),
  z.object({ type: z.literal('update'), payload: riskField.extend(reference) }),
  z.object({ type: z.enum(['resolve', 'reopen']), payload: z.object(reference) }),
])
const planField = z.object({
  classId: identifier,
  period: z.enum(['monthly', 'weekly', 'daily']),
  startDate: date,
  endDate: date,
  goals: note.default(''),
  activities: note.default(''),
  support: note.default(''),
})
const planCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create'), payload: planField }),
  z.object({ type: z.literal('update'), payload: planField.extend(reference) }),
  z.object({ type: z.enum(['submit', 'approve']), payload: z.object(reference) }),
  z.object({
    type: z.literal('return'),
    payload: z.object({ ...reference, reviewComment: note.min(1) }),
  }),
  z.object({
    type: z.literal('evaluate'),
    payload: z.object({ ...reference, evaluation: note.min(1) }),
  }),
  z.object({
    type: z.literal('copy'),
    payload: z.object({ ...reference, startDate: date, endDate: date }),
  }),
])

export interface RiskRecord {
  id: string
  childId: string | null
  occurredAt: string
  kind: 'accident' | 'near_miss'
  severity: 'low' | 'medium' | 'high'
  detail: string
  response: string
  prevention: string
  status: 'open' | 'resolved'
  authorId: string
  updatedBy: string
  version: number
  updatedAt: string
}
export interface PlanRecord {
  id: string
  classId: string
  period: 'monthly' | 'weekly' | 'daily'
  startDate: string
  endDate: string
  goals: string
  activities: string
  support: string
  evaluation: string
  reviewComment: string
  status: 'draft' | 'submitted' | 'approved'
  authorId: string
  updatedBy: string
  approvedBy: string | null
  approvedAt: string | null
  version: number
  updatedAt: string
}
const riskSelection = `id, child_id AS "childId", occurred_at AS "occurredAt", kind, severity, detail, response, prevention, status, author_id AS "authorId", updated_by AS "updatedBy", version, updated_at AS "updatedAt"`
const planSelection = `id, class_id AS "classId", period, to_char(start_date,'YYYY-MM-DD') AS "startDate", to_char(end_date,'YYYY-MM-DD') AS "endDate", goals, activities, support, evaluation, review_comment AS "reviewComment", status, author_id AS "authorId", updated_by AS "updatedBy", approved_by AS "approvedBy", approved_at AS "approvedAt", version, updated_at AS "updatedAt"`

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) throw new Error('InvalidInput')
  return result.data
}
function teacherOnly(user: User) {
  if (user.role !== 'teacher') throw new Error('Forbidden')
}
async function checkReference(
  db: OperationDatabase,
  user: User,
  table: 'child' | 'nursery_class',
  id: string | null,
) {
  if (!id) return
  const result = await db.query(`SELECT id FROM ${table} WHERE id = $1 AND facility_id = $2`, [
    id,
    user.facilityId,
  ])
  if (!result.rows.length) throw new Error('Forbidden')
}
function sameVersion(record: { version: number } | undefined, version: number) {
  if (!record) throw new Error('Forbidden')
  if (record.version !== version) throw new Error('Conflict')
}
function checkPeriod(period: PlanRecord['period'], startDate: string, endDate: string) {
  const span = (Date.parse(endDate) - Date.parse(startDate)) / 86400000
  if (
    span < 0 ||
    (period === 'daily' && span !== 0) ||
    (period === 'weekly' && span > 6) ||
    (period === 'monthly' && startDate.slice(0, 7) !== endDate.slice(0, 7))
  )
    throw new Error('InvalidInput')
}
export async function readRisks(db: OperationDatabase, user: User): Promise<RiskRecord[]> {
  teacherOnly(user)
  return (
    await db.query<RiskRecord>(
      `SELECT ${riskSelection} FROM risk_report WHERE facility_id = $1 ORDER BY occurred_at DESC, id`,
      [user.facilityId],
    )
  ).rows
}
export async function readPlans(db: OperationDatabase, user: User): Promise<PlanRecord[]> {
  teacherOnly(user)
  return (
    await db.query<PlanRecord>(
      `SELECT ${planSelection} FROM instruction_plan WHERE facility_id = $1 ORDER BY start_date DESC, id`,
      [user.facilityId],
    )
  ).rows
}
export async function mutateRisks(db: OperationDatabase, user: User, input: unknown) {
  teacherOnly(user)
  const command = parse(riskCommand, input)
  const p = command.payload
  if (command.type === 'create' || command.type === 'update') {
    const field = command.payload
    await checkReference(db, user, 'child', field.childId)
    if (Date.parse(field.occurredAt) > Date.now() + 60_000) throw new Error('InvalidInput')
    if (command.type === 'create') {
      const id = randomUUID()
      await db.query(
        `INSERT INTO risk_report (id,facility_id,child_id,occurred_at,kind,severity,detail,response,prevention,author_id,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
        [
          id,
          user.facilityId,
          field.childId,
          field.occurredAt,
          field.kind,
          field.severity,
          field.detail,
          field.response,
          field.prevention,
          user.id,
        ],
      )
      return { id }
    }
  }
  if (!('id' in p)) throw new Error('InvalidInput')
  const record = (
    await db.query<RiskRecord>(
      `SELECT ${riskSelection} FROM risk_report WHERE id = $1 AND facility_id = $2 FOR UPDATE`,
      [p.id, user.facilityId],
    )
  ).rows[0]
  sameVersion(record, p.version)
  if (command.type === 'update') {
    if (record.status !== 'open') throw new Error('Conflict')
    const field = command.payload
    await db.query(
      `UPDATE risk_report SET child_id=$3,occurred_at=$4,kind=$5,severity=$6,detail=$7,response=$8,prevention=$9,updated_by=$10,version=version+1,updated_at=now() WHERE id=$1 AND facility_id=$2`,
      [
        p.id,
        user.facilityId,
        field.childId,
        field.occurredAt,
        field.kind,
        field.severity,
        field.detail,
        field.response,
        field.prevention,
        user.id,
      ],
    )
  } else {
    if (command.type === 'resolve') {
      if (record.status !== 'open') throw new Error('Conflict')
      if (!record.response.trim() || !record.prevention.trim()) throw new Error('InvalidInput')
    } else if (record.status !== 'resolved') throw new Error('Conflict')
    await db.query(
      `UPDATE risk_report SET status=$3,updated_by=$4,version=version+1,updated_at=now() WHERE id=$1 AND facility_id=$2`,
      [p.id, user.facilityId, command.type === 'resolve' ? 'resolved' : 'open', user.id],
    )
  }
  return { id: p.id }
}
export async function mutatePlans(db: OperationDatabase, user: User, input: unknown) {
  teacherOnly(user)
  const command = parse(planCommand, input)
  if (command.type === 'create' || command.type === 'update') {
    const field = command.payload
    checkPeriod(field.period, field.startDate, field.endDate)
    await checkReference(db, user, 'nursery_class', field.classId)
    if (command.type === 'create') return insertPlan(db, user, field)
  }
  const p = command.payload
  if (!('id' in p)) throw new Error('InvalidInput')
  const record = (
    await db.query<PlanRecord>(
      `SELECT ${planSelection} FROM instruction_plan WHERE id=$1 AND facility_id=$2 FOR UPDATE`,
      [p.id, user.facilityId],
    )
  ).rows[0]
  sameVersion(record, p.version)
  switch (command.type) {
    case 'copy':
      checkPeriod(record.period, command.payload.startDate, command.payload.endDate)
      return insertPlan(db, user, {
        ...record,
        startDate: command.payload.startDate,
        endDate: command.payload.endDate,
      })
    case 'update': {
      if (record.status !== 'draft') throw new Error('Conflict')
      const field = command.payload
      await db.query(
        `UPDATE instruction_plan SET class_id=$3,period=$4,start_date=$5,end_date=$6,goals=$7,activities=$8,support=$9,updated_by=$10,version=version+1,updated_at=now() WHERE id=$1 AND facility_id=$2`,
        [
          p.id,
          user.facilityId,
          field.classId,
          field.period,
          field.startDate,
          field.endDate,
          field.goals,
          field.activities,
          field.support,
          user.id,
        ],
      )
      break
    }
    case 'submit':
      if (record.status !== 'draft') throw new Error('Conflict')
      if (!record.goals.trim() || !record.activities.trim() || !record.support.trim())
        throw new Error('InvalidInput')
      await db.query(
        `UPDATE instruction_plan SET status='submitted',review_comment='',updated_by=$3,version=version+1,updated_at=now() WHERE id=$1 AND facility_id=$2`,
        [p.id, user.facilityId, user.id],
      )
      break
    case 'approve':
    case 'return':
      if (!user.canManageFacility) throw new Error('Forbidden')
      if (record.status !== 'submitted') throw new Error('Conflict')
      await db.query(
        `UPDATE instruction_plan SET status=$3,review_comment=$4,approved_by=$5,approved_at=CASE WHEN $5::text IS NULL THEN NULL ELSE now() END,updated_by=$6,version=version+1,updated_at=now() WHERE id=$1 AND facility_id=$2`,
        [
          p.id,
          user.facilityId,
          command.type === 'approve' ? 'approved' : 'draft',
          command.type === 'return' ? command.payload.reviewComment : '',
          command.type === 'approve' ? user.id : null,
          user.id,
        ],
      )
      break
    case 'evaluate':
      if (record.status !== 'approved') throw new Error('Conflict')
      await db.query(
        `UPDATE instruction_plan SET evaluation=$3,updated_by=$4,version=version+1,updated_at=now() WHERE id=$1 AND facility_id=$2`,
        [p.id, user.facilityId, command.payload.evaluation, user.id],
      )
      break
  }
  return { id: p.id }
}
async function insertPlan(db: OperationDatabase, user: User, field: z.infer<typeof planField>) {
  const id = randomUUID()
  await db.query(
    `INSERT INTO instruction_plan (id,facility_id,class_id,period,start_date,end_date,goals,activities,support,author_id,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
    [
      id,
      user.facilityId,
      field.classId,
      field.period,
      field.startDate,
      field.endDate,
      field.goals,
      field.activities,
      field.support,
      user.id,
    ],
  )
  return { id }
}
