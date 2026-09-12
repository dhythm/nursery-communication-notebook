import type { Database } from '@/lib/db'
import type { User } from '@/lib/types'

interface UserRow {
  id: string
  name: string
  email: string
  role: User['role']
  facilityId: string
  facilitySlug: string
  jobTitle: string | null
  canManageFacility: boolean
}

async function findUser(database: Database, externalSubject: string): Promise<User | null> {
  const result = await database.query<UserRow>(
    `SELECT account.id, account.name, account.email, membership.role,
       membership.facility_id AS "facilityId", facility.slug AS "facilitySlug",
       membership.job_title AS "jobTitle",
       membership.can_manage_facility AS "canManageFacility"
     FROM app_user account
     JOIN facility_membership membership ON membership.user_id = account.id
     JOIN facility ON facility.id = membership.facility_id
     WHERE account.external_subject = $1 AND membership.ended_on IS NULL
     ORDER BY membership.started_on NULLS LAST, membership.facility_id, membership.role
     LIMIT 1`,
    [externalSubject],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    facilityId: row.facilityId,
    facilitySlug: row.facilitySlug,
    jobTitle: row.jobTitle ?? undefined,
    canManageFacility: row.canManageFacility,
  }
}

/** Maps a verified Clerk identity to a pre-registered nursery account. */
export async function resolveClerkUser(
  database: Database,
  externalSubject: string,
  verifiedEmail?: string,
): Promise<User | null> {
  const existing = await findUser(database, externalSubject)
  if (existing || !verifiedEmail) return existing

  await database.query(
    `UPDATE app_user SET external_subject = $1, updated_at = now()
     WHERE lower(email) = lower($2) AND external_subject IS NULL`,
    [externalSubject, verifiedEmail],
  )
  return findUser(database, externalSubject)
}
