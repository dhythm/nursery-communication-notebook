import type { Database } from './db'
import { assertFacilitySlug } from './facility-path'
import type { Role, User } from './types'

export async function canAccessFacility(
  database: Database,
  user: User,
  facilitySlug: string,
  role: Role,
) {
  try {
    assertFacilitySlug(facilitySlug)
  } catch {
    return false
  }
  const result = await database.query<{ allowed: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM facility
       JOIN facility_membership membership ON membership.facility_id = facility.id
       WHERE facility.slug = $1 AND facility.id = $2
         AND membership.user_id = $3 AND membership.role = $4
         AND membership.ended_on IS NULL
     ) AS allowed`,
    [facilitySlug, user.facilityId, user.id, role],
  )
  return result.rows[0]?.allowed === true
}
