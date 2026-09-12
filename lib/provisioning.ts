import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Database } from './db'
import { assertFacilitySlug } from './facility-path'

const inputSchema = z.object({
  facilitySlug: z.string().trim(),
  facilityName: z.string().trim().min(1).max(200),
  managerName: z.string().trim().min(1).max(200),
  managerEmail: z.string().trim().toLowerCase().email().max(320),
})

export interface FacilityProvisioningInput {
  facilitySlug: string
  facilityName: string
  managerName: string
  managerEmail: string
}

export interface FacilityProvisioningResult {
  facilityId: string
  managerUserId: string
}

export async function provisionFacility(
  database: Database,
  unsafeInput: FacilityProvisioningInput,
): Promise<FacilityProvisioningResult> {
  const input = inputSchema.parse(unsafeInput)
  assertFacilitySlug(input.facilitySlug)

  return database.transaction(async (transaction) => {
    await transaction.query('SELECT pg_advisory_xact_lock(72510432)')
    const existing = await transaction.query<{
      facilityId: string
      managerUserId: string
    }>(
      `SELECT facility.id AS "facilityId", app_user.id AS "managerUserId"
       FROM facility
       JOIN facility_membership membership ON membership.facility_id = facility.id
       JOIN app_user ON app_user.id = membership.user_id
       WHERE facility.slug = $1 AND lower(app_user.email) = $2
         AND membership.role = 'teacher' AND membership.can_manage_facility = true
         AND membership.ended_on IS NULL`,
      [input.facilitySlug, input.managerEmail],
    )
    if (existing.rows[0]) return existing.rows[0]

    const slugConflict = await transaction.query('SELECT id FROM facility WHERE slug = $1', [
      input.facilitySlug,
    ])
    if (slugConflict.rows.length) throw new Error('Facility slug already exists')
    const emailConflict = await transaction.query(
      'SELECT id FROM app_user WHERE lower(email) = $1',
      [input.managerEmail],
    )
    if (emailConflict.rows.length) throw new Error('Manager email already exists')

    const facilityId = randomUUID()
    const managerUserId = randomUUID()
    await transaction.query('INSERT INTO facility (id, slug, name) VALUES ($1, $2, $3)', [
      facilityId,
      input.facilitySlug,
      input.facilityName,
    ])
    await transaction.query('INSERT INTO app_user (id, name, email) VALUES ($1, $2, $3)', [
      managerUserId,
      input.managerName,
      input.managerEmail,
    ])
    await transaction.query(
      `INSERT INTO facility_membership
       (facility_id, user_id, role, access_scope, can_manage_facility, started_on)
       VALUES ($1, $2, 'teacher', 'facility', true, CURRENT_DATE)`,
      [facilityId, managerUserId],
    )
    return { facilityId, managerUserId }
  })
}
