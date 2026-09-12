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

export async function readNotebook(database: Database, user: User): Promise<NotebookSnapshot> {
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
         record.kind IN ('notebookEntries', 'messages')
         AND ($2 OR record.data->>'childId' = ANY($3::text[]))
         AND EXISTS (
           SELECT 1 FROM child
           WHERE child.id = record.data->>'childId'
             AND child.facility_id = $1
         )
       )
       OR (
         record.kind IN ('notices', 'sharedFiles', 'calendarEvents')
         AND record.data->>'facilityId' = $1
         AND $4
       )
     ORDER BY record.id`,
    [user.facilityId, isFacilityWide, accessibleChildIds, hasMembership],
  )
  const snapshot: NotebookSnapshot = {
    facilities: facilityResult.rows,
    children: childResult.rows,
    notebookEntries: [],
    notices: [],
    messages: [],
    sharedFiles: [],
    calendarEvents: [],
  }
  for (const kind of kinds) {
    if (kind === 'facilities' || kind === 'children') continue
    // Values enter the table only through the seed and validated mutations below.
    Object.assign(snapshot, {
      [kind]: result.rows.filter((row) => row.kind === kind).map((row) => row.data),
    })
  }
  const childIds = new Set(snapshot.children.map((child) => child.id))
  snapshot.notebookEntries = snapshot.notebookEntries
    .filter((entry) => childIds.has(entry.childId))
    .sort((a, b) => b.date.localeCompare(a.date))
  snapshot.messages = snapshot.messages
    .filter((message) => childIds.has(message.childId))
    .sort((a, b) => a.time.localeCompare(b.time))
  snapshot.notices = snapshot.notices
    .filter((notice) => notice.facilityId === user.facilityId)
    .sort((a, b) => b.date.localeCompare(a.date))
  snapshot.sharedFiles = snapshot.sharedFiles.filter(
    (file) =>
      file.facilityId === user.facilityId &&
      (isFacilityWide ||
        file.sharedWith === 'all' ||
        file.sharedWith.some((id) => childIds.has(id))),
  )
  snapshot.calendarEvents = snapshot.calendarEvents.filter(
    (event) => event.facilityId === user.facilityId,
  )
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
const commandSchema = z.discriminatedUnion('type', [
  z.object({
    commandId,
    type: z.literal('addNotebookEntry'),
    payload: z
      .object({
        childId: id,
        mood: z.enum(['genki', 'normal', 'tired', 'sick']),
        temperature,
        meals: text,
        nap: text,
        toilet: text,
        note: text,
        photo: text.optional(),
      })
      .strict(),
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

export async function mutateNotebook(
  database: Database,
  user: User,
  input: unknown,
  now = new Date(),
) {
  const command = commandSchema.parse(input)
  const snapshot = await readNotebook(database, user)
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
    addNotebookEntry: 'notebookEntries',
    addMessage: 'messages',
    addNotice: 'notices',
    addFile: 'sharedFiles',
    addEvent: 'calendarEvents',
  }
  const kind = kindByCommand[command.type]
  const recordId = randomUUID()
  const record = {
    ...payload,
    id: recordId,
    ...(command.type === 'addNotebookEntry'
      ? { author: user.role, authorName: user.name, date: todayInTimeZone(now) }
      : {}),
    ...(command.type === 'addMessage'
      ? { senderId: user.id, sender: user.role, senderName: user.name, time: now.toISOString() }
      : {}),
    ...(command.type === 'addNotice' ? { date: todayInTimeZone(now) } : {}),
    ...(command.type === 'addFile' ? { uploadedBy: user.name, date: todayInTimeZone(now) } : {}),
  }
  await database.transaction(async (transaction) => {
    const receipt = await transaction.query(
      `INSERT INTO mutation_receipt (actor_id, command_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING command_id`,
      [user.id, command.commandId],
    )
    if (receipt.rows.length === 0) return
    await transaction.query('INSERT INTO app_record (id, kind, data) VALUES ($1, $2, $3::jsonb)', [
      `${kind}:${recordId}`,
      kind,
      JSON.stringify(record),
    ])
  })
}
