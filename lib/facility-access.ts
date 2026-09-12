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

export async function canAccessChild(database: Database, user: User, childId: string) {
  if (user.role !== 'parent') return false
  const result = await database.query<{ allowed: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM guardian_child link
       JOIN child ON child.id = link.child_id AND child.facility_id = link.facility_id
       JOIN facility_membership membership
         ON membership.user_id = link.guardian_user_id
        AND membership.facility_id = link.facility_id
        AND membership.role = 'parent'
        AND membership.ended_on IS NULL
       WHERE link.guardian_user_id = $1
         AND link.child_id = $2
         AND link.facility_id = $3
         AND link.ended_on IS NULL
         AND child.withdrawn_on IS NULL
     ) AS allowed`,
    [user.id, childId, user.facilityId],
  )
  return result.rows[0]?.allowed === true
}
