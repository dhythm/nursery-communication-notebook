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

/** Development data storage; replace this repository when introducing the production domain schema. */
export async function seedNotebook(database: Database) {
  await database.transaction(async (transaction) => {
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
  const accessibleChildIds = user.childIds ?? []
  const result = await database.query<{ kind: (typeof kinds)[number]; data: { id: string } }>(
    `SELECT record.kind, record.data
     FROM app_record record
     WHERE
       (record.kind = 'facilities' AND record.data->>'id' = $1)
       OR (
         record.kind = 'children'
         AND record.data->>'facilityId' = $1
         AND ($2 OR record.data->>'id' = ANY($3::text[]))
       )
       OR (
         record.kind IN ('notebookEntries', 'messages')
         AND ($2 OR record.data->>'childId' = ANY($3::text[]))
         AND EXISTS (
           SELECT 1 FROM app_record child
           WHERE child.kind = 'children'
             AND child.data->>'id' = record.data->>'childId'
             AND child.data->>'facilityId' = $1
         )
       )
       OR (
         record.kind IN ('notices', 'sharedFiles', 'calendarEvents')
         AND record.data->>'facilityId' = $1
       )
     ORDER BY record.id`,
    [user.facilityId, user.role === 'teacher', accessibleChildIds],
  )
  const snapshot: NotebookSnapshot = {
    facilities: [],
    children: [],
    notebookEntries: [],
    notices: [],
    messages: [],
    sharedFiles: [],
    calendarEvents: [],
  }
  for (const kind of kinds) {
    // Values enter the table only through the seed and validated mutations below.
    Object.assign(snapshot, {
      [kind]: result.rows.filter((row) => row.kind === kind).map((row) => row.data),
    })
  }
  snapshot.facilities = snapshot.facilities.filter((facility) => facility.id === user.facilityId)
  snapshot.children = snapshot.children.filter(
    (child) =>
      child.facilityId === user.facilityId &&
      (user.role === 'teacher' || user.childIds?.includes(child.id)),
  )
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
      (user.role === 'teacher' ||
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
    if (
      user.role !== 'teacher' ||
      !snapshot.children.some((child) => child.id === command.payload.id)
    )
      throw new Error('Forbidden')
    await database.transaction(async (transaction) => {
      const receipt = await transaction.query(
        `INSERT INTO mutation_receipt (actor_id, command_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING command_id`,
        [user.id, command.commandId],
      )
      if (receipt.rows.length === 0) return
      const update = await transaction.query(
        `UPDATE app_record
         SET data = data || $2::jsonb || jsonb_build_object(
           'version', $4::integer + 1,
           'updatedAt', $5::text
         )
         WHERE id = $1
           AND kind = $3
           AND COALESCE((data->>'version')::integer, 1) = $4
         RETURNING id`,
        [
          `children:${command.payload.id}`,
          JSON.stringify(command.payload.patch),
          'children',
          command.payload.expectedVersion,
          now.toISOString(),
        ],
      )
      if (update.rows.length === 0) throw new Error('Conflict')
    })
    return
  }
  const payload = command.payload
  if ('childId' in payload) {
    if (!snapshot.children.some((child) => child.id === payload.childId))
      throw new Error('Forbidden')
  } else if (user.role !== 'teacher' || payload.facilityId !== user.facilityId) {
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
