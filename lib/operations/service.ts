import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Database } from '@/lib/db'
import type { User } from '@/lib/types'
import type { OperationDatabase } from './shared'
import { readAttendance, mutateAttendance } from './attendance'
import { readNap, mutateNap } from './nap'
import { readRisks, mutateRisks, readPlans, mutatePlans } from './risk-plans'

export const operationModuleSchema = z.enum(['risks', 'attendance', 'plans', 'nap'])
export type OperationModule = z.infer<typeof operationModuleSchema>
const commandSchema = z.object({
  commandId: z.string().min(1).max(100),
  type: z.string().min(1).max(80),
  payload: z.unknown(),
})
const reader = { risks: readRisks, attendance: readAttendance, plans: readPlans, nap: readNap }
const writer = {
  risks: mutateRisks,
  attendance: mutateAttendance,
  plans: mutatePlans,
  nap: mutateNap,
}

async function authorize(database: OperationDatabase, user: User): Promise<User> {
  if (user.role !== 'teacher') throw new Error('Forbidden')
  const { rows } = await database.query<{ can_manage_facility: boolean }>(
    `SELECT membership.can_manage_facility FROM facility_membership membership
     JOIN facility ON facility.id = membership.facility_id
     WHERE membership.facility_id = $1 AND membership.user_id = $2
       AND membership.role = 'teacher' AND membership.ended_on IS NULL
       AND (membership.started_on IS NULL OR membership.started_on <= (now() AT TIME ZONE facility.time_zone)::date)
     FOR SHARE OF membership`,
    [user.facilityId, user.id],
  )
  if (!rows[0]) throw new Error('Forbidden')
  return { ...user, canManageFacility: rows[0].can_manage_facility }
}

export async function readOperations(database: Database, user: User, module: OperationModule) {
  return database.transaction(async (transaction) => {
    const actor = await authorize(transaction, user)
    return reader[module](transaction, actor)
  })
}

export async function mutateOperations(
  database: Database,
  user: User,
  module: OperationModule,
  input: unknown,
) {
  const command = commandSchema.parse(input)
  await database.transaction(async (transaction) => {
    const actor = await authorize(transaction, user)
    const receiptId = `operations:${user.facilityId}:${module}:${command.commandId}`
    const receipt = await transaction.query(
      `INSERT INTO mutation_receipt (actor_id, command_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING command_id`,
      [actor.id, receiptId],
    )
    if (!receipt.rows.length) return
    const result = await writer[module](transaction, actor, {
      type: command.type,
      payload: command.payload,
    })
    const payload = command.payload as Record<string, unknown> | undefined
    await transaction.query(
      `INSERT INTO audit_log
       (id, facility_id, actor_user_id, actor_role, action, entity_type, entity_id, command_id, after_data)
       VALUES ($1, $2, $3, 'teacher', $4, $5, $6, $7, $8::jsonb)`,
      [
        randomUUID(),
        actor.facilityId,
        actor.id,
        command.type,
        module,
        result?.id ?? (typeof payload?.id === 'string' ? payload.id : actor.facilityId),
        receiptId,
        JSON.stringify({ type: command.type, payload: command.payload }),
      ],
    )
  })
}
