import type { Database } from '@/lib/db'
import type { Role, User } from '@/lib/types'
import { hashPassword, verifyPassword } from './password'

const dummyPasswordHash = hashPassword('not a real account password')

interface UserRow {
  id: string
  name: string
  email: string
  facilityId: string
  facilitySlug: string
  role: Role
  childIds: string[]
  jobTitle: string | null
  canManageFacility: boolean
}

const applicationUserSql = `
  SELECT member.id, member.name, member.email, membership.facility_id AS "facilityId",
    facility.slug AS "facilitySlug", membership.role, membership.job_title AS "jobTitle",
    membership.can_manage_facility AS "canManageFacility",
    COALESCE((SELECT array_agg(link.child_id ORDER BY link.child_id)
      FROM guardian_child link
      WHERE link.guardian_user_id = member.id
        AND link.facility_id = membership.facility_id
        AND link.ended_on IS NULL), ARRAY[]::text[]) AS "childIds"
  FROM app_user member
  JOIN facility_membership membership ON membership.user_id = member.id
  JOIN facility ON facility.id = membership.facility_id
  WHERE member.id = $1 AND membership.ended_on IS NULL
  ORDER BY membership.started_on NULLS LAST, membership.facility_id, membership.role
  LIMIT 1`

export async function getApplicationUser(database: Database, id: string): Promise<User | null> {
  const { rows } = await database.query<UserRow>(applicationUserSql, [id])
  if (!rows[0]) return null
  const row = rows[0]
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    facilityId: row.facilityId,
    facilitySlug: row.facilitySlug,
    role: row.role,
    childIds: row.childIds,
    ...(row.jobTitle ? { jobTitle: row.jobTitle } : {}),
    canManageFacility: row.canManageFacility,
  }
}

export async function setUserPassword(
  database: Database,
  email: string,
  password: string,
): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  const result = await database.query(
    `INSERT INTO user_password (user_id, password_hash)
     SELECT id, $2 FROM app_user WHERE lower(email) = lower($1)
     ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash,
       failed_attempt_count = 0, locked_until = NULL, password_changed_at = now()
     RETURNING user_id`,
    [email.trim(), passwordHash],
  )
  return result.rows.length === 1
}

export async function authenticateCredentials(
  database: Database,
  email: string,
  password: string,
): Promise<User | null> {
  const result = await database.query<{
    user_id: string
    password_hash: string
    failed_attempt_count: number
    locked_until: string | null
  }>(
    `SELECT password.user_id, password.password_hash,
       password.failed_attempt_count, password.locked_until::text
     FROM user_password password JOIN app_user member ON member.id = password.user_id
     WHERE lower(member.email) = lower($1)`,
    [email.trim()],
  )
  const credential = result.rows[0]
  if (!credential) {
    await verifyPassword(password, await dummyPasswordHash)
    return null
  }
  if (credential.locked_until && new Date(credential.locked_until) > new Date()) return null
  if (!(await verifyPassword(password, credential.password_hash))) {
    await database.query(
      `UPDATE user_password SET
         failed_attempt_count = failed_attempt_count + 1,
         locked_until = CASE WHEN failed_attempt_count + 1 >= 5
           THEN now() + interval '15 minutes' ELSE NULL END
       WHERE user_id = $1`,
      [credential.user_id],
    )
    return null
  }
  await database.query(
    'UPDATE user_password SET failed_attempt_count = 0, locked_until = NULL WHERE user_id = $1',
    [credential.user_id],
  )
  return getApplicationUser(database, credential.user_id)
}
