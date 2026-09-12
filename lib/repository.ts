import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Database } from './db'
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
  const result = await database.query<{ kind: (typeof kinds)[number]; data: { id: string } }>(
    'SELECT kind, data FROM app_record ORDER BY id',
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
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const role = z.enum(['parent', 'teacher'])
const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('addNotebookEntry'),
    payload: z
      .object({
        childId: id,
        date,
        author: role,
        authorName: text,
        mood: z.enum(['genki', 'normal', 'tired', 'sick']),
        temperature: text,
        meals: text,
        nap: text,
        toilet: text,
        note: text,
        photo: text.optional(),
      })
      .strict(),
  }),
  z.object({
    type: z.literal('addMessage'),
    payload: z
      .object({
        childId: id,
        sender: role,
        senderName: text,
        text: text.min(1),
        time: z.string().min(1).max(100),
      })
      .strict(),
  }),
  z.object({
    type: z.literal('addNotice'),
    payload: z
      .object({
        facilityId: id,
        title: text.min(1),
        body: text,
        date,
        category: z.enum(['重要', 'イベント', '保健', '給食', 'お願い']),
        pinned: z.boolean().optional(),
      })
      .strict(),
  }),
  z.object({
    type: z.literal('addFile'),
    payload: z
      .object({
        facilityId: id,
        name: text.min(1),
        kind: z.enum(['PDF', '画像', '文書']),
        sizeLabel: text,
        sharedWith: z.union([z.literal('all'), z.array(id)]),
        className: text.optional(),
        date,
        uploadedBy: text,
      })
      .strict(),
  }),
  z.object({
    type: z.literal('addEvent'),
    payload: z
      .object({
        facilityId: id,
        date,
        title: text.min(1),
        type: z.enum(['行事', '面談', '健診', '休園', '持ち物']),
        time: text.optional(),
        memo: text.optional(),
      })
      .strict(),
  }),
  z.object({
    type: z.literal('updateChild'),
    payload: z
      .object({
        id,
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

export async function mutateNotebook(database: Database, user: User, input: unknown) {
  const command = commandSchema.parse(input)
  const snapshot = await readNotebook(database, user)
  if (command.type === 'updateChild') {
    if (
      user.role !== 'teacher' ||
      !snapshot.children.some((child) => child.id === command.payload.id)
    )
      throw new Error('Forbidden')
    await database.query(
      'UPDATE app_record SET data = data || $2::jsonb WHERE id = $1 AND kind = $3',
      [`children:${command.payload.id}`, JSON.stringify(command.payload.patch), 'children'],
    )
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
    ...(command.type === 'addNotebookEntry' ? { author: user.role, authorName: user.name } : {}),
    ...(command.type === 'addMessage'
      ? { sender: user.role, senderName: user.name, time: new Date().toISOString() }
      : {}),
    ...(command.type === 'addFile' ? { uploadedBy: user.name } : {}),
  }
  await database.query('INSERT INTO app_record (id, kind, data) VALUES ($1, $2, $3::jsonb)', [
    `${kind}:${recordId}`,
    kind,
    JSON.stringify(record),
  ])
}
