import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Database } from './db'
import { todayInTimeZone } from './format'
import * as seed from './mock-data'
import type { NotebookSnapshot, User } from './types'

const kinds = [
  'facilities',
  'children',
  'notebookEntries',
  'notices',
  'messages',
  'sharedFiles',
  'calendarEvents',
] as const

/** Seed normalized core data and the remaining development feed records. */
export async function seedNotebook(database: Database) {
  await database.transaction(async (transaction) => {
    for (const facility of seed.facilities) {
      await transaction.query(
        `INSERT INTO facility (id, name, logo_color)
         VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [facility.id, facility.name, facility.logoColor],
      )
    }
    for (const user of seed.users) {
      await transaction.query(
        `INSERT INTO app_user (id, name, email, external_subject)
         VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [user.id, user.name, user.email, `skip:${user.id}`],
      )
      await transaction.query(
        `INSERT INTO facility_membership
         (facility_id, user_id, role, job_title, access_scope)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [
          user.facilityId,
          user.id,
          user.role,
          user.jobTitle ?? null,
          user.role === 'teacher' ? 'facility' : 'linked_children',
        ],
      )
    }
    for (const nurseryClass of seed.nurseryClasses) {
      await transaction.query(
        `INSERT INTO nursery_class (id, facility_id, name, school_year)
         VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [
          nurseryClass.id,
          nurseryClass.facilityId,
          nurseryClass.name,
          nurseryClass.schoolYear ?? null,
        ],
      )
    }
    for (const child of seed.children) {
      await transaction.query(
        `INSERT INTO child
         (id, facility_id, name, kana, birthday, avatar_color, allergies, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          child.id,
          child.facilityId,
          child.name,
          child.kana,
          child.birthday,
          child.avatarColor,
          child.allergies,
          child.notes,
        ],
      )
      await transaction.query(
        `INSERT INTO child_enrollment (id, facility_id, child_id, class_id)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM child_enrollment WHERE child_id = $3 AND ended_on IS NULL
         )
         ON CONFLICT (id) DO NOTHING`,
        [`enrollment-${child.id}-current`, child.facilityId, child.id, child.classId],
      )
    }
    for (const user of seed.users) {
      for (const childId of user.childIds ?? []) {
        await transaction.query(
          `INSERT INTO guardian_child (id, facility_id, guardian_user_id, child_id)
           VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
          [`guardian-${user.id}-${childId}`, user.facilityId, user.id, childId],
        )
      }
    }
    await transaction.query(
      `INSERT INTO staff_class_assignment
       (id, facility_id, staff_user_id, class_id, assignment_role)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      ['assignment-u2-class-f1-sora', 'f1', 'u2', 'class-f1-sora', '担任'],
    )
    for (const entry of seed.notebookEntries) {
      const child = seed.children.find((candidate) => candidate.id === entry.childId)!
      await transaction.query(
        `INSERT INTO notebook_entry
         (id, facility_id, child_id, business_date, author_user_id, author_role, author_name, mood,
          temperature, meals, nap, toilet, note, photo, status, published_at)
         VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9::numeric, $10, $11, $12, $13, $14,
                 'published', now())
         ON CONFLICT (id) DO NOTHING`,
        [
          entry.id,
          child.facilityId,
          entry.childId,
          entry.date,
          seed.users.find((user) => user.role === entry.author && user.name === entry.authorName)
            ?.id ?? null,
          entry.author,
          entry.authorName,
          entry.mood,
          entry.temperature,
          entry.meals,
          entry.nap,
          entry.toilet,
          entry.note,
          entry.photo ?? null,
        ],
      )
    }
    for (const notice of seed.notices) {
      await transaction.query(
        `INSERT INTO notice
         (id, facility_id, title, body, category, pinned, status, published_on, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'published', $7::date, now())
         ON CONFLICT (id) DO NOTHING`,
        [
          notice.id,
          notice.facilityId,
          notice.title,
          notice.body,
          notice.category,
          notice.pinned ?? false,
          notice.date,
        ],
      )
      await transaction.query(
        `INSERT INTO notice_recipient (notice_id, recipient_user_id)
         SELECT $1, membership.user_id FROM facility_membership membership
         WHERE membership.facility_id = $2 AND membership.role = 'parent'
           AND membership.ended_on IS NULL ON CONFLICT DO NOTHING`,
        [notice.id, notice.facilityId],
      )
    }
    for (const event of seed.calendarEvents) {
      await transaction.query(
        `INSERT INTO calendar_event
         (id, facility_id, event_date, title, event_type, event_time, memo, status, published_at)
         VALUES ($1, $2, $3::date, $4, $5, $6::time, $7, 'published', now())
         ON CONFLICT (id) DO NOTHING`,
        [
          event.id,
          event.facilityId,
          event.date,
          event.title,
          event.type,
          event.time ?? null,
          event.memo ?? null,
        ],
      )
    }
    for (const kind of kinds) {
      for (const record of seed[kind]) {
        await transaction.query(
          'INSERT INTO app_record (id, kind, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING',
          [`${kind}:${record.id}`, kind, JSON.stringify(record)],
        )
      }
    }
  })
}

export interface ReadNotebookOptions {
  from?: string
  to?: string
  search?: string
  limit?: number
  offset?: number
}

export async function readNotebook(
  database: Database,
  user: User,
  options: ReadNotebookOptions = {},
): Promise<NotebookSnapshot> {
  const limit = Math.max(1, Math.min(options.limit ?? 200, 500))
  const offset = Math.max(0, options.offset ?? 0)
  const search = (options.search ?? '').trim().slice(0, 100)
  const membership = await database.query<{ access_scope: 'linked_children' | 'facility' }>(
    `SELECT access_scope
     FROM facility_membership
     WHERE facility_id = $1 AND user_id = $2 AND role = $3 AND ended_on IS NULL`,
    [user.facilityId, user.id, user.role],
  )
  const hasMembership = membership.rows.length === 1
  const isFacilityWide = membership.rows[0]?.access_scope === 'facility'
  const facilityResult = hasMembership
    ? await database.query<NotebookSnapshot['facilities'][number]>(
        `SELECT id, name, logo_color AS "logoColor"
         FROM facility WHERE id = $1`,
        [user.facilityId],
      )
    : { rows: [] }
  const childResult = hasMembership
    ? await database.query<NotebookSnapshot['children'][number]>(
        `SELECT
           child.id,
           child.name,
           child.kana,
           child.facility_id AS "facilityId",
           nursery_class.id AS "classId",
           nursery_class.name AS "className",
           child.birthday::text AS birthday,
           child.avatar_color AS "avatarColor",
           child.allergies,
           child.notes,
           child.version,
           child.updated_at::text AS "updatedAt"
         FROM child
         JOIN child_enrollment
           ON child_enrollment.child_id = child.id AND child_enrollment.ended_on IS NULL
         JOIN nursery_class ON nursery_class.id = child_enrollment.class_id
         WHERE child.facility_id = $1
           AND child.withdrawn_on IS NULL
           AND (
             $2
             OR EXISTS (
               SELECT 1 FROM guardian_child
               WHERE guardian_child.facility_id = child.facility_id
                 AND guardian_child.child_id = child.id
                 AND guardian_child.guardian_user_id = $3
                 AND guardian_child.ended_on IS NULL
             )
           )
         ORDER BY child.id`,
        [user.facilityId, isFacilityWide, user.id],
      )
    : { rows: [] }
  const accessibleChildIds = childResult.rows.map((child) => child.id)
  const result = await database.query<{ kind: (typeof kinds)[number]; data: { id: string } }>(
    `SELECT record.kind, record.data
     FROM app_record record
     WHERE
       (
         record.kind = 'messages'
         AND ($2 OR record.data->>'childId' = ANY($3::text[]))
         AND EXISTS (
           SELECT 1 FROM child
           WHERE child.id = record.data->>'childId'
             AND child.facility_id = $1
         )
       )
       OR (
         record.kind = 'sharedFiles'
         AND record.data->>'facilityId' = $1
         AND $4
       )
     ORDER BY record.id
     LIMIT $5 OFFSET $6`,
    [user.facilityId, isFacilityWide, accessibleChildIds, hasMembership, limit, offset],
  )
  const snapshot: NotebookSnapshot = {
    facilities: facilityResult.rows,
    children: childResult.rows,
    notebookEntries: [],
    notices: [],
    messages: [],
    sharedFiles: [],
    calendarEvents: [],
    notificationPreferences: [],
    notifications: [],
    auditEvents: [],
    nurseryClasses: [],
    members: [],
  }
  for (const kind of kinds) {
    if (kind === 'facilities' || kind === 'children') continue
    // Values enter the table only through the seed and validated mutations below.
    Object.assign(snapshot, {
      [kind]: result.rows.filter((row) => row.kind === kind).map((row) => row.data),
    })
  }
  const childIds = new Set(snapshot.children.map((child) => child.id))
  snapshot.notebookEntries = hasMembership
    ? (
        await database.query<NotebookSnapshot['notebookEntries'][number]>(
          `SELECT entry.id, entry.child_id AS "childId", entry.business_date::text AS date,
             entry.author_role AS author, entry.author_name AS "authorName", entry.mood,
             entry.temperature::text AS temperature, entry.meals, entry.nap, entry.toilet,
             entry.note, entry.photo, entry.status, entry.version,
             entry.author_user_id AS "authorId", entry.updated_at::text AS "updatedAt"
           FROM notebook_entry entry
           WHERE entry.facility_id = $1 AND entry.child_id = ANY($2::text[])
             AND (entry.status = 'published' OR
                  (entry.status = 'draft' AND entry.author_user_id = $3))
             AND ($4::date IS NULL OR entry.business_date >= $4)
             AND ($5::date IS NULL OR entry.business_date <= $5)
             AND ($6 = '' OR entry.note ILIKE '%' || $6 || '%' OR entry.meals ILIKE '%' || $6 || '%')
           ORDER BY entry.business_date DESC, entry.created_at DESC LIMIT $7 OFFSET $8`,
          [
            user.facilityId,
            accessibleChildIds,
            user.id,
            options.from ?? null,
            options.to ?? null,
            search,
            limit,
            offset,
          ],
        )
      ).rows
    : []
  snapshot.messages = snapshot.messages
    .filter((message) => childIds.has(message.childId))
    .sort((a, b) => a.time.localeCompare(b.time))
  snapshot.notices = hasMembership
    ? (
        await database.query<NotebookSnapshot['notices'][number]>(
          `SELECT notice.id, notice.facility_id AS "facilityId", notice.title, notice.body,
             notice.category, notice.pinned, notice.requires_confirmation AS "requiresConfirmation",
             notice.status, notice.version, notice.target_class_id AS "targetClassId",
             COALESCE(notice.published_on, notice.created_at::date)::text AS date,
             recipient.read_at::text AS "readAt", recipient.confirmed_at::text AS "confirmedAt",
             (SELECT count(*)::integer FROM notice_recipient r WHERE r.notice_id = notice.id) AS "recipientCount",
             (SELECT count(*)::integer FROM notice_recipient r WHERE r.notice_id = notice.id AND r.read_at IS NOT NULL) AS "readCount",
             (SELECT count(*)::integer FROM notice_recipient r WHERE r.notice_id = notice.id AND r.confirmed_at IS NOT NULL) AS "confirmationCount"
           FROM notice
           LEFT JOIN notice_recipient recipient
             ON recipient.notice_id = notice.id AND recipient.recipient_user_id = $2
           WHERE notice.facility_id = $1 AND notice.status <> 'withdrawn'
             AND ($3 OR (notice.status = 'published' AND recipient.recipient_user_id IS NOT NULL))
             AND ($4::date IS NULL OR COALESCE(notice.published_on, notice.created_at::date) >= $4)
             AND ($5::date IS NULL OR COALESCE(notice.published_on, notice.created_at::date) <= $5)
             AND ($6 = '' OR notice.title ILIKE '%' || $6 || '%' OR notice.body ILIKE '%' || $6 || '%')
           ORDER BY notice.pinned DESC, date DESC, notice.created_at DESC LIMIT $7 OFFSET $8`,
          [
            user.facilityId,
            user.id,
            isFacilityWide,
            options.from ?? null,
            options.to ?? null,
            search,
            limit,
            offset,
          ],
        )
      ).rows
    : []
  snapshot.sharedFiles = hasMembership
    ? (
        await database.query<NotebookSnapshot['sharedFiles'][number]>(
          `SELECT file.id, file.facility_id AS "facilityId", file.display_name AS name,
             file.kind, CASE WHEN file.byte_size < 1048576
               THEN round(file.byte_size / 1024.0)::text || ' KB'
               ELSE round(file.byte_size / 1048576.0, 1)::text || ' MB' END AS "sizeLabel",
             CASE WHEN file.audience_type = 'all' THEN to_jsonb('all'::text)
               ELSE jsonb_build_array(file.target_class_id) END AS "sharedWith",
             class.name AS "className", file.created_at::date::text AS date,
             uploader.name AS "uploadedBy", file.content_type AS "contentType",
             file.byte_size::integer AS "byteSize", '/api/files/' || file.id AS "downloadUrl"
           FROM file_object file
           JOIN app_user uploader ON uploader.id = file.uploader_user_id
           LEFT JOIN nursery_class class ON class.id = file.target_class_id
           WHERE file.facility_id = $1 AND file.status = 'available' AND file.purpose = 'shared'
             AND ($2 OR file.audience_type = 'all' OR EXISTS (
               SELECT 1 FROM guardian_child guardian
               JOIN child_enrollment enrollment ON enrollment.child_id = guardian.child_id
               WHERE guardian.guardian_user_id = $3 AND guardian.ended_on IS NULL
                 AND enrollment.ended_on IS NULL AND enrollment.class_id = file.target_class_id
             ))
             AND ($4 = '' OR file.display_name ILIKE '%' || $4 || '%')
           ORDER BY file.created_at DESC LIMIT $5 OFFSET $6`,
          [user.facilityId, isFacilityWide, user.id, search, limit, offset],
        )
      ).rows
    : []
  snapshot.calendarEvents = hasMembership
    ? (
        await database.query<NotebookSnapshot['calendarEvents'][number]>(
          `SELECT event.id, event.facility_id AS "facilityId", event.event_date::text AS date,
             event.title, event.event_type AS type,
             to_char(event.event_time, 'HH24:MI') AS time, event.memo, event.status,
             event.version, event.target_class_id AS "targetClassId"
           FROM calendar_event event
           WHERE event.facility_id = $1 AND event.status <> 'cancelled'
             AND ($2 OR (event.status = 'published' AND
               (event.target_type = 'all' OR event.target_class_id IN (
                 SELECT enrollment.class_id FROM child_enrollment enrollment
                 JOIN guardian_child guardian ON guardian.child_id = enrollment.child_id
                 WHERE guardian.guardian_user_id = $3 AND guardian.ended_on IS NULL
                   AND enrollment.ended_on IS NULL
               ))))
             AND ($4::date IS NULL OR event.event_date >= $4)
             AND ($5::date IS NULL OR event.event_date <= $5)
             AND ($6 = '' OR event.title ILIKE '%' || $6 || '%' OR COALESCE(event.memo, '') ILIKE '%' || $6 || '%')
           ORDER BY event.event_date, event.event_time NULLS LAST LIMIT $7 OFFSET $8`,
          [
            user.facilityId,
            isFacilityWide,
            user.id,
            options.from ?? null,
            options.to ?? null,
            search,
            limit,
            offset,
          ],
        )
      ).rows
    : []
  if (hasMembership) {
    snapshot.notificationPreferences = (
      await database.query<NotebookSnapshot['notificationPreferences'][number]>(
        `SELECT category.value AS category,
           COALESCE(preference.enabled, category.default_enabled) AS enabled
         FROM (VALUES ('notice', true), ('message', true), ('notebook', false))
           AS category(value, default_enabled)
         LEFT JOIN notification_preference preference
           ON preference.category = category.value AND preference.facility_id = $1
             AND preference.user_id = $2
         ORDER BY category.value`,
        [user.facilityId, user.id],
      )
    ).rows
    snapshot.notifications = (
      await database.query<NotebookSnapshot['notifications'][number]>(
        `SELECT id, category, title, source_type AS "sourceType", source_id AS "sourceId",
           created_at::text AS "createdAt", read_at::text AS "readAt"
         FROM app_notification
         WHERE facility_id = $1 AND recipient_user_id = $2
         ORDER BY created_at DESC LIMIT 100`,
        [user.facilityId, user.id],
      )
    ).rows
    if (isFacilityWide) {
      snapshot.nurseryClasses = (
        await database.query<NotebookSnapshot['nurseryClasses'][number]>(
          `SELECT id, facility_id AS "facilityId", name, school_year AS "schoolYear"
           FROM nursery_class WHERE facility_id = $1 ORDER BY school_year DESC NULLS LAST, name`,
          [user.facilityId],
        )
      ).rows
      snapshot.members = (
        await database.query<NotebookSnapshot['members'][number]>(
          `SELECT member.id, member.name, member.email, membership.role, membership.job_title AS "jobTitle",
             COALESCE((SELECT array_agg(assignment.class_id ORDER BY assignment.class_id)
               FROM staff_class_assignment assignment WHERE assignment.staff_user_id = member.id
                 AND assignment.facility_id = membership.facility_id AND assignment.ended_on IS NULL), ARRAY[]::text[]) AS "assignedClassIds",
             COALESCE((SELECT array_agg(link.child_id ORDER BY link.child_id)
               FROM guardian_child link WHERE link.guardian_user_id = member.id
                 AND link.facility_id = membership.facility_id AND link.ended_on IS NULL), ARRAY[]::text[]) AS "linkedChildIds"
           FROM facility_membership membership JOIN app_user member ON member.id = membership.user_id
           WHERE membership.facility_id = $1 AND membership.ended_on IS NULL
           ORDER BY membership.role DESC, member.name`,
          [user.facilityId],
        )
      ).rows
      snapshot.auditEvents = (
        await database.query<NotebookSnapshot['auditEvents'][number]>(
          `SELECT audit.id, COALESCE(actor.name, 'システム') AS "actorName",
             audit.actor_role AS "actorRole", audit.action, audit.entity_type AS "entityType",
             audit.entity_id AS "entityId", audit.occurred_at::text AS "occurredAt"
           FROM audit_log audit LEFT JOIN app_user actor ON actor.id = audit.actor_user_id
           WHERE audit.facility_id = $1
             AND ($2 = '' OR audit.entity_type ILIKE '%' || $2 || '%' OR audit.entity_id ILIKE '%' || $2 || '%')
           ORDER BY audit.occurred_at DESC LIMIT $3 OFFSET $4`,
          [user.facilityId, search, limit, offset],
        )
      ).rows
    }
  }
  return snapshot
}

const text = z.string().max(10_000)
const id = z.string().min(1).max(100)
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    )
  })
const commandId = z.string().min(1).max(100)
const temperature = z
  .string()
  .regex(/^\d{2}(?:\.\d)?$/)
  .refine((value) => Number(value) >= 34 && Number(value) <= 42)
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
const notebookFields = {
  childId: id,
  mood: z.enum(['genki', 'normal', 'tired', 'sick']),
  temperature,
  meals: text,
  nap: text,
  toilet: text,
  note: text,
  photo: text.optional(),
}
const noticeFields = {
  title: text.min(1),
  body: text,
  category: z.enum(['重要', 'イベント', '保健', '給食', 'お願い']),
  pinned: z.boolean().optional(),
  requiresConfirmation: z.boolean().optional(),
  targetClassId: id.nullable().optional(),
}
const eventPatch = z
  .object({
    date: date.optional(),
    title: text.min(1).optional(),
    type: z.enum(['行事', '面談', '健診', '休園', '持ち物']).optional(),
    time: time.nullable().optional(),
    memo: text.nullable().optional(),
    targetClassId: id.nullable().optional(),
    status: z.enum(['draft', 'published']).optional(),
  })
  .strict()
const commandSchema = z.discriminatedUnion('type', [
  z.object({
    commandId,
    type: z.literal('addNotebookEntry'),
    payload: z.object(notebookFields).strict(),
  }),
  z.object({
    commandId,
    type: z.literal('saveNotebookEntry'),
    payload: z.object({ ...notebookFields, status: z.enum(['draft', 'published']) }).strict(),
  }),
  z.object({
    commandId,
    type: z.literal('updateNotebookEntry'),
    payload: z
      .object({
        id,
        expectedVersion: z.number().int().positive(),
        patch: z
          .object({
            mood: notebookFields.mood.optional(),
            temperature: temperature.optional(),
            meals: text.optional(),
            nap: text.optional(),
            toilet: text.optional(),
            note: text.optional(),
            photo: text.nullable().optional(),
            status: z.enum(['draft', 'published']).optional(),
          })
          .strict(),
      })
      .strict(),
  }),
  z.object({
    commandId,
    type: z.literal('withdrawNotebookEntry'),
    payload: z.object({ id, expectedVersion: z.number().int().positive() }).strict(),
  }),
  z.object({
    commandId,
    type: z.literal('addMessage'),
    payload: z
      .object({
        childId: id,
        text: text.min(1),
      })
      .strict(),
  }),
  z.object({
    commandId,
    type: z.literal('saveNotice'),
    payload: z.object({ ...noticeFields, status: z.enum(['draft', 'published']) }).strict(),
  }),
  z.object({
    commandId,
    type: z.literal('updateNotice'),
    payload: z
      .object({
        id,
        expectedVersion: z.number().int().positive(),
        patch: z
          .object({
            title: text.min(1).optional(),
            body: text.optional(),
            category: z.enum(['重要', 'イベント', '保健', '給食', 'お願い']).optional(),
            pinned: z.boolean().optional(),
            requiresConfirmation: z.boolean().optional(),
            targetClassId: id.nullable().optional(),
            status: z.enum(['draft', 'published']).optional(),
          })
          .strict(),
      })
      .strict(),
  }),
  z.object({
    commandId,
    type: z.literal('withdrawNotice'),
    payload: z.object({ id, expectedVersion: z.number().int().positive() }).strict(),
  }),
  z.object({ commandId, type: z.literal('markNoticeRead'), payload: z.object({ id }).strict() }),
  z.object({ commandId, type: z.literal('confirmNotice'), payload: z.object({ id }).strict() }),
  z.object({
    commandId,
    type: z.literal('addNotice'),
    payload: z
      .object({
        facilityId: id,
        title: text.min(1),
        body: text,
        category: z.enum(['重要', 'イベント', '保健', '給食', 'お願い']),
        pinned: z.boolean().optional(),
      })
      .strict(),
  }),
  z.object({
    commandId,
    type: z.literal('updateEvent'),
    payload: z
      .object({ id, expectedVersion: z.number().int().positive(), patch: eventPatch })
      .strict(),
  }),
  z.object({
    commandId,
    type: z.literal('cancelEvent'),
    payload: z.object({ id, expectedVersion: z.number().int().positive() }).strict(),
  }),
  z.object({
    commandId,
    type: z.literal('updateNotificationPreference'),
    payload: z
      .object({ category: z.enum(['notice', 'message', 'notebook']), enabled: z.boolean() })
      .strict(),
  }),
  z.object({
    commandId,
    type: z.literal('markNotificationRead'),
    payload: z.object({ id }).strict(),
  }),
  z.object({
    commandId,
    type: z.literal('createClass'),
    payload: z
      .object({ name: text.min(1).max(100), schoolYear: z.number().int().min(2000).max(2200) })
      .strict(),
  }),
  z.object({
    commandId,
    type: z.literal('createMember'),
    payload: z
      .object({
        name: text.min(1).max(100),
        email: z.email().max(320),
        role: z.enum(['parent', 'teacher']),
        jobTitle: text.max(100).optional(),
      })
      .strict(),
  }),
  z.object({
    commandId,
    type: z.literal('createChild'),
    payload: z
      .object({
        name: text.min(1).max(100),
        kana: text.max(100),
        birthday: date,
        classId: id,
        avatarColor: text.min(1).max(100),
        allergies: z.array(text.max(100)).max(50),
        notes: text,
        guardianUserIds: z.array(id).max(20),
      })
      .strict(),
  }),
  z.object({
    commandId,
    type: z.literal('moveChildClass'),
    payload: z.object({ id, expectedVersion: z.number().int().positive(), classId: id }).strict(),
  }),
  z.object({
    commandId,
    type: z.literal('withdrawChild'),
    payload: z.object({ id, expectedVersion: z.number().int().positive() }).strict(),
  }),
  z.object({
    commandId,
    type: z.literal('assignStaffClass'),
    payload: z.object({ staffUserId: id, classId: id }).strict(),
  }),
  z.object({
    commandId,
    type: z.literal('linkGuardianChild'),
    payload: z.object({ guardianUserId: id, childId: id }).strict(),
  }),
  z.object({
    commandId,
    type: z.literal('endMembership'),
    payload: z.object({ userId: id, role: z.enum(['parent', 'teacher']) }).strict(),
  }),
  z.object({
    commandId,
    type: z.literal('addFile'),
    payload: z
      .object({
        facilityId: id,
        name: text.min(1),
        kind: z.enum(['PDF', '画像', '文書']),
        sizeLabel: text,
        sharedWith: z.union([z.literal('all'), z.array(id)]),
        className: text.optional(),
      })
      .strict(),
  }),
  z.object({
    commandId,
    type: z.literal('addEvent'),
    payload: z
      .object({
        facilityId: id,
        date,
        title: text.min(1),
        type: z.enum(['行事', '面談', '健診', '休園', '持ち物']),
        time: time.optional(),
        memo: text.optional(),
        targetClassId: id.optional(),
        status: z.enum(['draft', 'published']).optional(),
      })
      .strict(),
  }),
  z.object({
    commandId,
    type: z.literal('updateChild'),
    payload: z
      .object({
        id,
        expectedVersion: z.number().int().positive(),
        patch: z
          .object({
            name: text.min(1).optional(),
            kana: text.optional(),
            className: text.optional(),
            birthday: date.optional(),
            avatarColor: text.optional(),
            allergies: z.array(text).optional(),
            notes: text.optional(),
          })
          .strict(),
      })
      .strict(),
  }),
])

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

async function acceptCommand(transaction: Transaction, actorId: string, receiptId: string) {
  const receipt = await transaction.query(
    `INSERT INTO mutation_receipt (actor_id, command_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING RETURNING command_id`,
    [actorId, receiptId],
  )
  return receipt.rows.length > 0
}

async function writeAudit(
  transaction: Transaction,
  user: User,
  receiptId: string,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
  now: Date,
) {
  await transaction.query(
    `INSERT INTO audit_log
     (id, facility_id, actor_user_id, actor_role, action, entity_type, entity_id,
      command_id, before_data, after_data, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)`,
    [
      randomUUID(),
      user.facilityId,
      user.id,
      user.role,
      action,
      entityType,
      entityId,
      receiptId,
      before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after),
      now.toISOString(),
    ],
  )
}

async function createNotifications(
  transaction: Transaction,
  user: User,
  category: 'notice' | 'message' | 'notebook',
  sourceType: string,
  sourceId: string,
  title: string,
  now: Date,
  options: { childId?: string; targetClassId?: string } = {},
) {
  const defaultEnabled = category !== 'notebook'
  const recipientSql =
    category === 'notice'
      ? `SELECT DISTINCT membership.user_id
         FROM facility_membership membership
         WHERE membership.facility_id = $1 AND membership.role = 'parent'
           AND membership.ended_on IS NULL AND membership.user_id <> $2
           AND ($3::text IS NULL OR EXISTS (
             SELECT 1 FROM guardian_child guardian
             JOIN child_enrollment enrollment ON enrollment.child_id = guardian.child_id
             WHERE guardian.guardian_user_id = membership.user_id
               AND guardian.ended_on IS NULL AND enrollment.ended_on IS NULL
               AND enrollment.class_id = $3
           ))`
      : user.role === 'teacher'
        ? `SELECT DISTINCT guardian.guardian_user_id AS user_id
           FROM guardian_child guardian
           WHERE guardian.facility_id = $1 AND guardian.child_id = $3
             AND guardian.ended_on IS NULL AND guardian.guardian_user_id <> $2`
        : `SELECT DISTINCT membership.user_id
           FROM facility_membership membership
           WHERE membership.facility_id = $1 AND membership.role = 'teacher'
             AND membership.ended_on IS NULL AND membership.user_id <> $2`
  const recipientParams =
    category === 'notice'
      ? [user.facilityId, user.id, options.targetClassId ?? null]
      : user.role === 'teacher'
        ? [user.facilityId, user.id, options.childId ?? null]
        : [user.facilityId, user.id]
  const recipients = await transaction.query<{ user_id: string }>(recipientSql, recipientParams)
  for (const recipient of recipients.rows) {
    const preference = await transaction.query<{ enabled: boolean }>(
      `SELECT enabled FROM notification_preference
       WHERE facility_id = $1 AND user_id = $2 AND category = $3`,
      [user.facilityId, recipient.user_id, category],
    )
    if ((preference.rows[0]?.enabled ?? defaultEnabled) === false) continue
    const notificationId = randomUUID()
    const inserted = await transaction.query<{ id: string }>(
      `INSERT INTO app_notification
       (id, facility_id, recipient_user_id, category, source_type, source_id, title, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (recipient_user_id, category, source_type, source_id) DO NOTHING
       RETURNING id`,
      [
        notificationId,
        user.facilityId,
        recipient.user_id,
        category,
        sourceType,
        sourceId,
        title,
        now.toISOString(),
      ],
    )
    if (inserted.rows.length > 0) {
      await transaction.query(
        `INSERT INTO notification_outbox
         (id, notification_id, status, attempt_count, processed_at)
         VALUES ($1, $2, 'sent', 1, $3)`,
        [randomUUID(), notificationId, now.toISOString()],
      )
    }
  }
}

async function populateNoticeRecipients(
  transaction: Transaction,
  facilityId: string,
  noticeId: string,
  targetClassId?: string | null,
) {
  await transaction.query(
    `INSERT INTO notice_recipient (notice_id, recipient_user_id)
     SELECT $2, membership.user_id
     FROM facility_membership membership
     WHERE membership.facility_id = $1 AND membership.role = 'parent'
       AND membership.ended_on IS NULL
       AND ($3::text IS NULL OR EXISTS (
         SELECT 1 FROM guardian_child guardian
         JOIN child_enrollment enrollment ON enrollment.child_id = guardian.child_id
         WHERE guardian.guardian_user_id = membership.user_id
           AND guardian.ended_on IS NULL AND enrollment.ended_on IS NULL
           AND enrollment.class_id = $3
       ))
     ON CONFLICT DO NOTHING`,
    [facilityId, noticeId, targetClassId ?? null],
  )
}

export async function mutateNotebook(
  database: Database,
  user: User,
  input: unknown,
  now = new Date(),
) {
  const command = commandSchema.parse(input)
  const snapshot = await readNotebook(database, user)
  if (command.type === 'addNotebookEntry' || command.type === 'saveNotebookEntry') {
    if (!snapshot.children.some((child) => child.id === command.payload.childId))
      throw new Error('Forbidden')
    const entryId = randomUUID()
    const status = command.type === 'addNotebookEntry' ? 'published' : command.payload.status
    await database.transaction(async (transaction) => {
      if (!(await acceptCommand(transaction, user.id, command.commandId))) return
      await transaction.query(
        `INSERT INTO notebook_entry
         (id, facility_id, child_id, business_date, author_user_id, author_role, author_name,
          mood, temperature, meals, nap, toilet, note, photo, status, published_at,
          created_at, updated_at)
         VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9::numeric, $10, $11, $12,
                 $13, $14, $15, CASE WHEN $15 = 'published' THEN $16::timestamptz END, $16, $16)`,
        [
          entryId,
          user.facilityId,
          command.payload.childId,
          todayInTimeZone(now),
          user.id,
          user.role,
          user.name,
          command.payload.mood,
          command.payload.temperature,
          command.payload.meals,
          command.payload.nap,
          command.payload.toilet,
          command.payload.note,
          command.payload.photo ?? null,
          status,
          now.toISOString(),
        ],
      )
      await writeAudit(
        transaction,
        user,
        command.commandId,
        status === 'draft' ? 'draft_saved' : 'published',
        'notebook_entry',
        entryId,
        null,
        { childId: command.payload.childId, status },
        now,
      )
      if (status === 'published') {
        await createNotifications(
          transaction,
          user,
          'notebook',
          'notebook_entry',
          entryId,
          `${user.name}さんが連絡帳を更新しました`,
          now,
          { childId: command.payload.childId },
        )
      }
    })
    return
  }
  if (command.type === 'updateNotebookEntry' || command.type === 'withdrawNotebookEntry') {
    const existing = snapshot.notebookEntries.find((entry) => entry.id === command.payload.id)
    if (!existing || existing.authorId !== user.id) throw new Error('Forbidden')
    await database.transaction(async (transaction) => {
      if (!(await acceptCommand(transaction, user.id, command.commandId))) return
      const patch = command.type === 'updateNotebookEntry' ? command.payload.patch : {}
      const status = command.type === 'withdrawNotebookEntry' ? 'withdrawn' : patch.status
      const updated = await transaction.query<{ version: number }>(
        `UPDATE notebook_entry SET
           mood = COALESCE($2, mood), temperature = COALESCE($3::numeric, temperature),
           meals = COALESCE($4, meals), nap = COALESCE($5, nap),
           toilet = COALESCE($6, toilet), note = COALESCE($7, note),
           photo = CASE WHEN $8::boolean THEN $9 ELSE photo END,
           status = COALESCE($10, status),
           published_at = CASE WHEN $10 = 'published' AND published_at IS NULL THEN $11 ELSE published_at END,
           withdrawn_at = CASE WHEN $10 = 'withdrawn' THEN $11 ELSE withdrawn_at END,
           version = version + 1, updated_at = $11
         WHERE id = $1 AND facility_id = $12 AND author_user_id = $13 AND version = $14
           AND status <> 'withdrawn'
         RETURNING version`,
        [
          command.payload.id,
          'mood' in patch ? (patch.mood ?? null) : null,
          'temperature' in patch ? (patch.temperature ?? null) : null,
          'meals' in patch ? (patch.meals ?? null) : null,
          'nap' in patch ? (patch.nap ?? null) : null,
          'toilet' in patch ? (patch.toilet ?? null) : null,
          'note' in patch ? (patch.note ?? null) : null,
          'photo' in patch,
          'photo' in patch ? (patch.photo ?? null) : null,
          status ?? null,
          now.toISOString(),
          user.facilityId,
          user.id,
          command.payload.expectedVersion,
        ],
      )
      if (updated.rows.length === 0) throw new Error('Conflict')
      await writeAudit(
        transaction,
        user,
        command.commandId,
        status === 'withdrawn' ? 'withdrawn' : status === 'published' ? 'published' : 'updated',
        'notebook_entry',
        command.payload.id,
        existing,
        {
          ...existing,
          ...patch,
          status: status ?? existing.status,
          version: updated.rows[0].version,
        },
        now,
      )
      if (status === 'published' && existing.status !== 'published') {
        await createNotifications(
          transaction,
          user,
          'notebook',
          'notebook_entry',
          command.payload.id,
          `${user.name}さんが連絡帳を更新しました`,
          now,
          { childId: existing.childId },
        )
      }
    })
    return
  }
  if (command.type === 'addNotice' || command.type === 'saveNotice') {
    if (user.role !== 'teacher') throw new Error('Forbidden')
    const noticeId = randomUUID()
    const status = command.type === 'addNotice' ? 'published' : command.payload.status
    const targetClassId = command.type === 'saveNotice' ? command.payload.targetClassId : undefined
    if (targetClassId && !snapshot.children.some((child) => child.classId === targetClassId))
      throw new Error('Forbidden')
    await database.transaction(async (transaction) => {
      if (!(await acceptCommand(transaction, user.id, command.commandId))) return
      await transaction.query(
        `INSERT INTO notice
         (id, facility_id, title, body, category, pinned, requires_confirmation,
          target_type, target_class_id, status, created_by_user_id, updated_by_user_id,
          published_on, published_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8::text IS NULL THEN 'all' ELSE 'class' END,
                 $8, $9, $10, $10, CASE WHEN $9 = 'published' THEN $11::date END,
                 CASE WHEN $9 = 'published' THEN $12::timestamptz END, $12, $12)`,
        [
          noticeId,
          user.facilityId,
          command.payload.title,
          command.payload.body,
          command.payload.category,
          command.payload.pinned ?? false,
          command.type === 'saveNotice' ? (command.payload.requiresConfirmation ?? false) : false,
          targetClassId ?? null,
          status,
          user.id,
          todayInTimeZone(now),
          now.toISOString(),
        ],
      )
      if (status === 'published') {
        await populateNoticeRecipients(transaction, user.facilityId, noticeId, targetClassId)
        await createNotifications(
          transaction,
          user,
          'notice',
          'notice',
          noticeId,
          command.payload.title,
          now,
          { targetClassId: targetClassId ?? undefined },
        )
      }
      await writeAudit(
        transaction,
        user,
        command.commandId,
        status,
        'notice',
        noticeId,
        null,
        {
          title: command.payload.title,
          status,
        },
        now,
      )
    })
    return
  }
  if (command.type === 'updateNotice' || command.type === 'withdrawNotice') {
    if (user.role !== 'teacher') throw new Error('Forbidden')
    const existing = snapshot.notices.find((notice) => notice.id === command.payload.id)
    if (!existing) throw new Error('Forbidden')
    const patch = command.type === 'updateNotice' ? command.payload.patch : {}
    const nextStatus = command.type === 'withdrawNotice' ? 'withdrawn' : patch.status
    const targetClassId =
      'targetClassId' in patch ? (patch.targetClassId ?? null) : existing.targetClassId
    if (targetClassId && !snapshot.children.some((child) => child.classId === targetClassId))
      throw new Error('Forbidden')
    await database.transaction(async (transaction) => {
      if (!(await acceptCommand(transaction, user.id, command.commandId))) return
      const updated = await transaction.query<{ version: number }>(
        `UPDATE notice SET title = COALESCE($2, title), body = COALESCE($3, body),
           category = COALESCE($4, category), pinned = COALESCE($5, pinned),
           requires_confirmation = COALESCE($6, requires_confirmation),
           target_type = CASE WHEN $7::boolean THEN CASE WHEN $8::text IS NULL THEN 'all' ELSE 'class' END ELSE target_type END,
           target_class_id = CASE WHEN $7::boolean THEN $8 ELSE target_class_id END,
           status = COALESCE($9, status), updated_by_user_id = $10,
           published_on = CASE WHEN $9 = 'published' AND published_on IS NULL THEN $11::date ELSE published_on END,
           published_at = CASE WHEN $9 = 'published' AND published_at IS NULL THEN $12 ELSE published_at END,
           withdrawn_at = CASE WHEN $9 = 'withdrawn' THEN $12 ELSE withdrawn_at END,
           version = version + 1, updated_at = $12
         WHERE id = $1 AND facility_id = $13 AND version = $14 AND status <> 'withdrawn'
         RETURNING version`,
        [
          command.payload.id,
          'title' in patch ? (patch.title ?? null) : null,
          'body' in patch ? (patch.body ?? null) : null,
          'category' in patch ? (patch.category ?? null) : null,
          'pinned' in patch ? (patch.pinned ?? null) : null,
          'requiresConfirmation' in patch ? (patch.requiresConfirmation ?? null) : null,
          'targetClassId' in patch,
          targetClassId ?? null,
          nextStatus ?? null,
          user.id,
          todayInTimeZone(now),
          now.toISOString(),
          user.facilityId,
          command.payload.expectedVersion,
        ],
      )
      if (updated.rows.length === 0) throw new Error('Conflict')
      if (nextStatus === 'published' && existing.status !== 'published') {
        await populateNoticeRecipients(
          transaction,
          user.facilityId,
          command.payload.id,
          targetClassId,
        )
        await createNotifications(
          transaction,
          user,
          'notice',
          'notice',
          command.payload.id,
          ('title' in patch && patch.title) || existing.title,
          now,
          { targetClassId: targetClassId ?? undefined },
        )
      }
      await writeAudit(
        transaction,
        user,
        command.commandId,
        nextStatus === 'withdrawn'
          ? 'withdrawn'
          : nextStatus === 'published'
            ? 'published'
            : 'updated',
        'notice',
        command.payload.id,
        existing,
        {
          ...existing,
          ...patch,
          status: nextStatus ?? existing.status,
          version: updated.rows[0].version,
        },
        now,
      )
    })
    return
  }
  if (command.type === 'markNoticeRead' || command.type === 'confirmNotice') {
    if (user.role !== 'parent') throw new Error('Forbidden')
    const existing = snapshot.notices.find((notice) => notice.id === command.payload.id)
    if (!existing || (command.type === 'confirmNotice' && !existing.requiresConfirmation))
      throw new Error('Forbidden')
    await database.transaction(async (transaction) => {
      if (!(await acceptCommand(transaction, user.id, command.commandId))) return
      const changed = await transaction.query(
        command.type === 'confirmNotice'
          ? `UPDATE notice_recipient SET read_at = COALESCE(read_at, $3), confirmed_at = COALESCE(confirmed_at, $3)
             WHERE notice_id = $1 AND recipient_user_id = $2 RETURNING notice_id`
          : `UPDATE notice_recipient SET read_at = COALESCE(read_at, $3)
             WHERE notice_id = $1 AND recipient_user_id = $2 RETURNING notice_id`,
        [command.payload.id, user.id, now.toISOString()],
      )
      if (changed.rows.length === 0) throw new Error('Forbidden')
      await writeAudit(
        transaction,
        user,
        command.commandId,
        command.type === 'confirmNotice' ? 'confirmed' : 'read',
        'notice',
        command.payload.id,
        null,
        null,
        now,
      )
    })
    return
  }
  if (
    command.type === 'addEvent' ||
    command.type === 'updateEvent' ||
    command.type === 'cancelEvent'
  ) {
    if (user.role !== 'teacher') throw new Error('Forbidden')
    const isCreate = command.type === 'addEvent'
    const existing = isCreate
      ? undefined
      : snapshot.calendarEvents.find((event) => event.id === command.payload.id)
    if (!isCreate && !existing) throw new Error('Forbidden')
    if (isCreate && command.payload.facilityId !== user.facilityId) throw new Error('Forbidden')
    await database.transaction(async (transaction) => {
      if (!(await acceptCommand(transaction, user.id, command.commandId))) return
      if (command.type === 'addEvent') {
        const eventId = randomUUID()
        const status = command.payload.status ?? 'published'
        if (
          command.payload.targetClassId &&
          !snapshot.children.some((child) => child.classId === command.payload.targetClassId)
        )
          throw new Error('Forbidden')
        await transaction.query(
          `INSERT INTO calendar_event
           (id, facility_id, event_date, title, event_type, event_time, memo, target_type, target_class_id, status,
            created_by_user_id, updated_by_user_id, published_at, created_at, updated_at)
           VALUES ($1, $2, $3::date, $4, $5, $6::time, $7,
             CASE WHEN $8::text IS NULL THEN 'all' ELSE 'class' END, $8, $9, $10, $10,
             CASE WHEN $9 = 'published' THEN $11::timestamptz END, $11, $11)`,
          [
            eventId,
            user.facilityId,
            command.payload.date,
            command.payload.title,
            command.payload.type,
            command.payload.time ?? null,
            command.payload.memo ?? null,
            command.payload.targetClassId ?? null,
            status,
            user.id,
            now.toISOString(),
          ],
        )
        await writeAudit(
          transaction,
          user,
          command.commandId,
          status,
          'calendar_event',
          eventId,
          null,
          command.payload,
          now,
        )
      } else {
        const patch = command.type === 'updateEvent' ? command.payload.patch : {}
        const status = command.type === 'cancelEvent' ? 'cancelled' : patch.status
        const updated = await transaction.query(
          `UPDATE calendar_event SET event_date = COALESCE($2::date, event_date),
             title = COALESCE($3, title), event_type = COALESCE($4, event_type),
             event_time = CASE WHEN $5::boolean THEN $6::time ELSE event_time END,
             memo = CASE WHEN $7::boolean THEN $8 ELSE memo END,
             target_type = CASE WHEN $9::boolean THEN CASE WHEN $10::text IS NULL THEN 'all' ELSE 'class' END ELSE target_type END,
             target_class_id = CASE WHEN $9::boolean THEN $10 ELSE target_class_id END,
             status = COALESCE($11, status), updated_by_user_id = $12,
             published_at = CASE WHEN $11 = 'published' AND published_at IS NULL THEN $13 ELSE published_at END,
             cancelled_at = CASE WHEN $11 = 'cancelled' THEN $13 ELSE cancelled_at END,
             version = version + 1, updated_at = $13
           WHERE id = $1 AND facility_id = $14 AND version = $15 AND status <> 'cancelled'
           RETURNING id`,
          [
            command.payload.id,
            'date' in patch ? (patch.date ?? null) : null,
            'title' in patch ? (patch.title ?? null) : null,
            'type' in patch ? (patch.type ?? null) : null,
            'time' in patch,
            'time' in patch ? (patch.time ?? null) : null,
            'memo' in patch,
            'memo' in patch ? (patch.memo ?? null) : null,
            'targetClassId' in patch,
            'targetClassId' in patch ? (patch.targetClassId ?? null) : null,
            status ?? null,
            user.id,
            now.toISOString(),
            user.facilityId,
            command.payload.expectedVersion,
          ],
        )
        if (updated.rows.length === 0) throw new Error('Conflict')
        await writeAudit(
          transaction,
          user,
          command.commandId,
          status === 'cancelled' ? 'cancelled' : 'updated',
          'calendar_event',
          command.payload.id,
          existing,
          { ...existing, ...patch, status },
          now,
        )
      }
    })
    return
  }
  if (command.type === 'updateNotificationPreference') {
    if (!snapshot.facilities.length) throw new Error('Forbidden')
    await database.transaction(async (transaction) => {
      if (!(await acceptCommand(transaction, user.id, command.commandId))) return
      await transaction.query(
        `INSERT INTO notification_preference (facility_id, user_id, category, enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (facility_id, user_id, category) DO UPDATE
         SET enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at`,
        [
          user.facilityId,
          user.id,
          command.payload.category,
          command.payload.enabled,
          now.toISOString(),
        ],
      )
      await writeAudit(
        transaction,
        user,
        command.commandId,
        'updated',
        'notification_preference',
        command.payload.category,
        null,
        command.payload,
        now,
      )
    })
    return
  }
  if (command.type === 'markNotificationRead') {
    await database.transaction(async (transaction) => {
      if (!(await acceptCommand(transaction, user.id, command.commandId))) return
      const changed = await transaction.query(
        `UPDATE app_notification SET read_at = COALESCE(read_at, $3)
         WHERE id = $1 AND recipient_user_id = $2 RETURNING id`,
        [command.payload.id, user.id, now.toISOString()],
      )
      if (changed.rows.length === 0) throw new Error('Forbidden')
      await writeAudit(
        transaction,
        user,
        command.commandId,
        'read',
        'notification',
        command.payload.id,
        null,
        null,
        now,
      )
    })
    return
  }
  if (
    command.type === 'createClass' ||
    command.type === 'createMember' ||
    command.type === 'createChild' ||
    command.type === 'moveChildClass' ||
    command.type === 'withdrawChild' ||
    command.type === 'assignStaffClass' ||
    command.type === 'linkGuardianChild' ||
    command.type === 'endMembership'
  ) {
    if (user.role !== 'teacher' || !snapshot.facilities.length) throw new Error('Forbidden')
    if (command.type === 'endMembership' && command.payload.userId === user.id)
      throw new Error('Forbidden')
    await database.transaction(async (transaction) => {
      if (!(await acceptCommand(transaction, user.id, command.commandId))) return
      if (command.type === 'createClass') {
        const entityId = randomUUID()
        const inserted = await transaction.query(
          `INSERT INTO nursery_class (id, facility_id, name, school_year)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id`,
          [entityId, user.facilityId, command.payload.name, command.payload.schoolYear],
        )
        if (!inserted.rows.length) throw new Error('Conflict')
        await writeAudit(
          transaction,
          user,
          command.commandId,
          'created',
          'nursery_class',
          entityId,
          null,
          command.payload,
          now,
        )
        return
      }
      if (command.type === 'createMember') {
        const proposedId = randomUUID()
        const member = await transaction.query<{ id: string }>(
          `INSERT INTO app_user (id, name, email) VALUES ($1, $2, lower($3))
           ON CONFLICT (email) DO UPDATE SET updated_at = app_user.updated_at RETURNING id`,
          [proposedId, command.payload.name, command.payload.email],
        )
        const entityId = member.rows[0].id
        const membership = await transaction.query(
          `INSERT INTO facility_membership
           (facility_id, user_id, role, job_title, access_scope, started_on)
           VALUES ($1, $2, $3, $4, $5, $6::date)
           ON CONFLICT (facility_id, user_id, role) DO UPDATE
             SET job_title = EXCLUDED.job_title, access_scope = EXCLUDED.access_scope,
                 started_on = EXCLUDED.started_on, ended_on = NULL, updated_at = now()
             WHERE facility_membership.ended_on IS NOT NULL
           RETURNING user_id`,
          [
            user.facilityId,
            entityId,
            command.payload.role,
            command.payload.jobTitle ?? null,
            command.payload.role === 'teacher' ? 'facility' : 'linked_children',
            todayInTimeZone(now),
          ],
        )
        if (!membership.rows.length) throw new Error('Conflict')
        await writeAudit(
          transaction,
          user,
          command.commandId,
          'created',
          'facility_membership',
          entityId,
          null,
          command.payload,
          now,
        )
        return
      }
      if (command.type === 'createChild') {
        if (command.payload.birthday > todayInTimeZone(now)) throw new Error('InvalidDate')
        if (!snapshot.nurseryClasses.some((item) => item.id === command.payload.classId))
          throw new Error('Forbidden')
        if (
          command.payload.guardianUserIds.some(
            (guardianId) =>
              !snapshot.members.some(
                (member) => member.id === guardianId && member.role === 'parent',
              ),
          )
        )
          throw new Error('Forbidden')
        const entityId = randomUUID()
        await transaction.query(
          `INSERT INTO child
           (id, facility_id, name, kana, birthday, avatar_color, allergies, notes, admitted_on)
           VALUES ($1, $2, $3, $4, $5::date, $6, $7::text[], $8, $9::date)`,
          [
            entityId,
            user.facilityId,
            command.payload.name,
            command.payload.kana,
            command.payload.birthday,
            command.payload.avatarColor,
            command.payload.allergies,
            command.payload.notes,
            todayInTimeZone(now),
          ],
        )
        await transaction.query(
          `INSERT INTO child_enrollment (id, facility_id, child_id, class_id, started_on)
           VALUES ($1, $2, $3, $4, $5::date)`,
          [randomUUID(), user.facilityId, entityId, command.payload.classId, todayInTimeZone(now)],
        )
        for (const guardianId of command.payload.guardianUserIds) {
          await transaction.query(
            `INSERT INTO guardian_child
             (id, facility_id, guardian_user_id, child_id, started_on)
             VALUES ($1, $2, $3, $4, $5::date)`,
            [randomUUID(), user.facilityId, guardianId, entityId, todayInTimeZone(now)],
          )
        }
        await writeAudit(
          transaction,
          user,
          command.commandId,
          'created',
          'child',
          entityId,
          null,
          command.payload,
          now,
        )
        return
      }
      if (command.type === 'moveChildClass') {
        const existing = snapshot.children.find((child) => child.id === command.payload.id)
        if (
          !existing ||
          !snapshot.nurseryClasses.some((item) => item.id === command.payload.classId)
        )
          throw new Error('Forbidden')
        const updated = await transaction.query(
          `UPDATE child SET version = version + 1, updated_at = $4
           WHERE id = $1 AND facility_id = $2 AND version = $3 RETURNING version`,
          [command.payload.id, user.facilityId, command.payload.expectedVersion, now.toISOString()],
        )
        if (!updated.rows.length) throw new Error('Conflict')
        await transaction.query(
          `UPDATE child_enrollment SET ended_on = $2::date, updated_at = $3
           WHERE child_id = $1 AND ended_on IS NULL`,
          [command.payload.id, todayInTimeZone(now), now.toISOString()],
        )
        await transaction.query(
          `INSERT INTO child_enrollment (id, facility_id, child_id, class_id, started_on)
           VALUES ($1, $2, $3, $4, $5::date)`,
          [
            randomUUID(),
            user.facilityId,
            command.payload.id,
            command.payload.classId,
            todayInTimeZone(now),
          ],
        )
        await writeAudit(
          transaction,
          user,
          command.commandId,
          'class_changed',
          'child',
          command.payload.id,
          existing,
          command.payload,
          now,
        )
        return
      }
      if (command.type === 'withdrawChild') {
        const existing = snapshot.children.find((child) => child.id === command.payload.id)
        if (!existing) throw new Error('Forbidden')
        const updated = await transaction.query(
          `UPDATE child SET withdrawn_on = $4::date, version = version + 1, updated_at = $5
           WHERE id = $1 AND facility_id = $2 AND version = $3 AND withdrawn_on IS NULL RETURNING id`,
          [
            command.payload.id,
            user.facilityId,
            command.payload.expectedVersion,
            todayInTimeZone(now),
            now.toISOString(),
          ],
        )
        if (!updated.rows.length) throw new Error('Conflict')
        await transaction.query(
          `UPDATE child_enrollment SET ended_on = $2::date, updated_at = $3 WHERE child_id = $1 AND ended_on IS NULL`,
          [command.payload.id, todayInTimeZone(now), now.toISOString()],
        )
        await transaction.query(
          `UPDATE guardian_child SET ended_on = $2::date, updated_at = $3 WHERE child_id = $1 AND ended_on IS NULL`,
          [command.payload.id, todayInTimeZone(now), now.toISOString()],
        )
        await writeAudit(
          transaction,
          user,
          command.commandId,
          'withdrawn',
          'child',
          command.payload.id,
          existing,
          null,
          now,
        )
        return
      }
      if (command.type === 'assignStaffClass') {
        if (
          !snapshot.members.some(
            (member) => member.id === command.payload.staffUserId && member.role === 'teacher',
          ) ||
          !snapshot.nurseryClasses.some((item) => item.id === command.payload.classId)
        )
          throw new Error('Forbidden')
        await transaction.query(
          `INSERT INTO staff_class_assignment
           (id, facility_id, staff_user_id, class_id, started_on)
           VALUES ($1, $2, $3, $4, $5::date) ON CONFLICT DO NOTHING`,
          [
            randomUUID(),
            user.facilityId,
            command.payload.staffUserId,
            command.payload.classId,
            todayInTimeZone(now),
          ],
        )
        await writeAudit(
          transaction,
          user,
          command.commandId,
          'assigned',
          'staff_class_assignment',
          command.payload.staffUserId,
          null,
          command.payload,
          now,
        )
        return
      }
      if (command.type === 'linkGuardianChild') {
        if (
          !snapshot.members.some(
            (member) => member.id === command.payload.guardianUserId && member.role === 'parent',
          ) ||
          !snapshot.children.some((child) => child.id === command.payload.childId)
        )
          throw new Error('Forbidden')
        await transaction.query(
          `INSERT INTO guardian_child
           (id, facility_id, guardian_user_id, child_id, started_on)
           VALUES ($1, $2, $3, $4, $5::date) ON CONFLICT DO NOTHING`,
          [
            randomUUID(),
            user.facilityId,
            command.payload.guardianUserId,
            command.payload.childId,
            todayInTimeZone(now),
          ],
        )
        await writeAudit(
          transaction,
          user,
          command.commandId,
          'linked',
          'guardian_child',
          command.payload.guardianUserId,
          null,
          command.payload,
          now,
        )
        return
      }
      const existing = snapshot.members.find(
        (member) => member.id === command.payload.userId && member.role === command.payload.role,
      )
      if (!existing) throw new Error('Forbidden')
      const ended = await transaction.query(
        `UPDATE facility_membership SET ended_on = $4::date, updated_at = $5
         WHERE facility_id = $1 AND user_id = $2 AND role = $3 AND ended_on IS NULL RETURNING user_id`,
        [
          user.facilityId,
          command.payload.userId,
          command.payload.role,
          todayInTimeZone(now),
          now.toISOString(),
        ],
      )
      if (!ended.rows.length) throw new Error('Conflict')
      if (command.payload.role === 'teacher')
        await transaction.query(
          `UPDATE staff_class_assignment SET ended_on = $3::date, updated_at = $4 WHERE facility_id = $1 AND staff_user_id = $2 AND ended_on IS NULL`,
          [user.facilityId, command.payload.userId, todayInTimeZone(now), now.toISOString()],
        )
      else
        await transaction.query(
          `UPDATE guardian_child SET ended_on = $3::date, updated_at = $4 WHERE facility_id = $1 AND guardian_user_id = $2 AND ended_on IS NULL`,
          [user.facilityId, command.payload.userId, todayInTimeZone(now), now.toISOString()],
        )
      await writeAudit(
        transaction,
        user,
        command.commandId,
        'ended',
        'facility_membership',
        command.payload.userId,
        existing,
        null,
        now,
      )
    })
    return
  }
  if (command.type === 'updateChild') {
    const existingChild = snapshot.children.find((child) => child.id === command.payload.id)
    if (user.role !== 'teacher' || !existingChild) throw new Error('Forbidden')
    await database.transaction(async (transaction) => {
      const receipt = await transaction.query(
        `INSERT INTO mutation_receipt (actor_id, command_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING command_id`,
        [user.id, command.commandId],
      )
      if (receipt.rows.length === 0) return
      const patch = command.payload.patch
      const update = await transaction.query(
        `UPDATE child
         SET name = COALESCE($2, name),
             kana = COALESCE($3, kana),
             birthday = COALESCE($4::date, birthday),
             avatar_color = COALESCE($5, avatar_color),
             allergies = COALESCE($6::text[], allergies),
             notes = COALESCE($7, notes),
             version = version + 1,
             updated_at = $8
         WHERE id = $1 AND facility_id = $9 AND version = $10
         RETURNING id`,
        [
          command.payload.id,
          patch.name ?? null,
          patch.kana ?? null,
          patch.birthday ?? null,
          patch.avatarColor ?? null,
          patch.allergies ?? null,
          patch.notes ?? null,
          now.toISOString(),
          user.facilityId,
          command.payload.expectedVersion,
        ],
      )
      if (update.rows.length === 0) throw new Error('Conflict')
      if (patch.className && patch.className !== existingChild.className) {
        const nurseryClass = await transaction.query<{ id: string }>(
          `SELECT id FROM nursery_class
           WHERE facility_id = $1 AND name = $2
           ORDER BY school_year DESC NULLS LAST LIMIT 1`,
          [user.facilityId, patch.className],
        )
        if (!nurseryClass.rows[0]) throw new Error('InvalidClass')
        await transaction.query(
          `UPDATE child_enrollment
           SET ended_on = $2, updated_at = $3
           WHERE child_id = $1 AND ended_on IS NULL`,
          [command.payload.id, todayInTimeZone(now), now.toISOString()],
        )
        await transaction.query(
          `INSERT INTO child_enrollment
           (id, facility_id, child_id, class_id, started_on)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            randomUUID(),
            user.facilityId,
            command.payload.id,
            nurseryClass.rows[0].id,
            todayInTimeZone(now),
          ],
        )
      }
      await transaction.query(
        `UPDATE app_record
         SET data = data || $2::jsonb || jsonb_build_object(
           'version', $4::integer + 1,
           'updatedAt', $5::text
         )
         WHERE id = $1 AND kind = $3`,
        [
          `children:${command.payload.id}`,
          JSON.stringify(command.payload.patch),
          'children',
          command.payload.expectedVersion,
          now.toISOString(),
        ],
      )
      await writeAudit(
        transaction,
        user,
        command.commandId,
        'updated',
        'child',
        command.payload.id,
        existingChild,
        { ...existingChild, ...command.payload.patch },
        now,
      )
    })
    return
  }
  const payload = command.payload
  if ('childId' in payload) {
    if (!snapshot.children.some((child) => child.id === payload.childId))
      throw new Error('Forbidden')
  } else if (
    user.role !== 'teacher' ||
    payload.facilityId !== user.facilityId ||
    !snapshot.facilities.some((facility) => facility.id === user.facilityId)
  ) {
    throw new Error('Forbidden')
  }
  if (
    command.type === 'addFile' &&
    command.payload.sharedWith !== 'all' &&
    command.payload.sharedWith.some(
      (childId) => !snapshot.children.some((child) => child.id === childId),
    )
  ) {
    throw new Error('Forbidden')
  }
  const kindByCommand = {
    addMessage: 'messages',
    addFile: 'sharedFiles',
  }
  const kind = kindByCommand[command.type]
  const recordId = randomUUID()
  const record = {
    ...payload,
    id: recordId,
    ...(command.type === 'addMessage'
      ? { senderId: user.id, sender: user.role, senderName: user.name, time: now.toISOString() }
      : {}),
    ...(command.type === 'addFile' ? { uploadedBy: user.name, date: todayInTimeZone(now) } : {}),
  }
  await database.transaction(async (transaction) => {
    if (!(await acceptCommand(transaction, user.id, command.commandId))) return
    await transaction.query('INSERT INTO app_record (id, kind, data) VALUES ($1, $2, $3::jsonb)', [
      `${kind}:${recordId}`,
      kind,
      JSON.stringify(record),
    ])
    await writeAudit(
      transaction,
      user,
      command.commandId,
      'created',
      command.type === 'addMessage' ? 'message' : 'legacy_file',
      recordId,
      null,
      record,
      now,
    )
    if (command.type === 'addMessage') {
      await createNotifications(
        transaction,
        user,
        'message',
        'message',
        recordId,
        `${user.name}さんからメッセージが届きました`,
        now,
        { childId: command.payload.childId },
      )
    }
  })
}
