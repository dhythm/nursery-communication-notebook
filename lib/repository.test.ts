import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from './db'
import { seedNotebook, readNotebook, mutateNotebook } from './repository'
import { users } from './mock-data'

let database: Database
const parent = users.find((user) => user.role === 'parent')!
const teacher = users.find((user) => user.role === 'teacher')!
beforeAll(async () => {
  database = await createDatabase({ databaseProvider: 'pglite', pgliteDataDir: 'memory://' })
  await migrateDatabase(database)
  await seedNotebook(database)
}, 20_000)
afterAll(async () => {
  await database?.close()
})

describe('notebook repository', () => {
  it('filters children for parents and isolates facilities', async () => {
    const snapshot = await readNotebook(database, parent)
    expect(snapshot.children.map((child) => child.id).sort()).toEqual(['c1', 'c2'])
    expect(snapshot.facilities.map((facility) => facility.id)).toEqual(['f1'])
    expect((await readNotebook(database, teacher)).children).toHaveLength(4)
  })
  it('seeds normalized users, classes, memberships, and relationships idempotently', async () => {
    await seedNotebook(database)
    expect((await database.query('SELECT id FROM app_user ORDER BY id')).rows).toEqual([
      { id: 'u1' },
      { id: 'u2' },
    ])
    expect((await database.query('SELECT id FROM nursery_class ORDER BY id')).rows).toEqual([
      { id: 'class-f1-niji' },
      { id: 'class-f1-sora' },
      { id: 'class-f1-tsuki' },
    ])
    expect(
      (
        await database.query(
          'SELECT guardian_user_id, child_id FROM guardian_child ORDER BY child_id',
        )
      ).rows,
    ).toEqual([
      { guardian_user_id: 'u1', child_id: 'c1' },
      { guardian_user_id: 'u1', child_id: 'c2' },
    ])
  })
  it('uses normalized guardian links instead of User.childIds for access', async () => {
    const forgedUser = { ...parent, childIds: ['c3'] }
    expect(
      (await readNotebook(database, forgedUser)).children.map((child) => child.id).sort(),
    ).toEqual(['c1', 'c2'])
  })
  it('stores a message, derives the author and preserves it on reseed', async () => {
    await mutateNotebook(database, parent, {
      commandId: 'message-once',
      type: 'addMessage',
      payload: {
        childId: 'c1',
        text: '検証メッセージ',
      },
    })
    await seedNotebook(database)
    const snapshot = await readNotebook(database, parent)
    expect(snapshot.messages.find((message) => message.text === '検証メッセージ')).toMatchObject({
      senderId: parent.id,
      sender: 'parent',
      senderName: parent.name,
    })
  })
  it('rejects unauthorized child access and teacher-only mutations', async () => {
    await expect(
      mutateNotebook(database, parent, {
        commandId: 'unauthorized-message',
        type: 'addMessage',
        payload: {
          childId: 'c3',
          text: 'denied',
        },
      }),
    ).rejects.toThrow(/Forbidden/)
    await expect(
      mutateNotebook(database, parent, {
        commandId: 'unauthorized-child-update',
        type: 'updateChild',
        payload: { id: 'c1', expectedVersion: 1, patch: { notes: 'denied' } },
      }),
    ).rejects.toThrow(/Forbidden/)
  })
  it('validates mutation fields and blocks facility reassignment', async () => {
    await expect(
      mutateNotebook(database, teacher, {
        commandId: 'invalid-facility-update',
        type: 'updateChild',
        payload: { id: 'c1', expectedVersion: 1, patch: { facilityId: 'f2' } },
      }),
    ).rejects.toThrow()
    await expect(
      mutateNotebook(database, parent, {
        commandId: 'invalid-message',
        type: 'addMessage',
        payload: { text: '' },
      }),
    ).rejects.toThrow()
  })
  it('rejects impossible dates, implausible temperatures, and invalid event times', async () => {
    const entry = {
      commandId: 'invalid-entry-date',
      type: 'addNotebookEntry' as const,
      payload: {
        childId: 'c1',
        mood: 'genki' as const,
        temperature: '36.5',
        meals: '',
        nap: '',
        toilet: '',
        note: '',
      },
    }
    await expect(
      mutateNotebook(database, parent, {
        ...entry,
        commandId: 'invalid-temperature-text',
        payload: { ...entry.payload, temperature: 'hot' },
      }),
    ).rejects.toThrow()
    await expect(
      mutateNotebook(database, parent, {
        ...entry,
        commandId: 'invalid-temperature-range',
        payload: { ...entry.payload, temperature: '43.0' },
      }),
    ).rejects.toThrow()
    await expect(
      mutateNotebook(database, teacher, {
        commandId: 'invalid-event-date',
        type: 'addEvent',
        payload: {
          facilityId: teacher.facilityId,
          date: '2026-02-29',
          title: 'invalid date',
          type: '行事',
        },
      }),
    ).rejects.toThrow()
    await expect(
      mutateNotebook(database, teacher, {
        commandId: 'invalid-event-time',
        type: 'addEvent',
        payload: {
          facilityId: teacher.facilityId,
          date: '2026-09-12',
          title: 'invalid time',
          type: '行事',
          time: '25:00',
        },
      }),
    ).rejects.toThrow()
  })
  it('deduplicates a retried command and derives its business date on the server', async () => {
    const command = {
      commandId: 'same-notebook-command',
      type: 'addNotebookEntry' as const,
      payload: {
        childId: 'c1',
        mood: 'genki' as const,
        temperature: '36.5',
        meals: '',
        nap: '',
        toilet: '',
        note: '再送テスト',
      },
    }
    const now = new Date('2026-09-12T15:30:00.000Z')
    await mutateNotebook(database, parent, command, now)
    await mutateNotebook(database, parent, command, now)
    const entries = (await readNotebook(database, parent)).notebookEntries.filter(
      (entry) => entry.note === '再送テスト',
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      date: '2026-09-13',
      author: 'parent',
      authorName: parent.name,
    })
  })
  it('rejects an update based on an old child version', async () => {
    await mutateNotebook(database, teacher, {
      commandId: 'first-child-update',
      type: 'updateChild',
      payload: { id: 'c2', expectedVersion: 1, patch: { notes: 'first' } },
    })
    await expect(
      mutateNotebook(database, teacher, {
        commandId: 'stale-child-update',
        type: 'updateChild',
        payload: { id: 'c2', expectedVersion: 1, patch: { notes: 'stale' } },
      }),
    ).rejects.toThrow('Conflict')
    expect(
      (await readNotebook(database, teacher)).children.find((child) => child.id === 'c2'),
    ).toMatchObject({
      notes: 'first',
      version: 2,
    })
  })
  it('keeps class enrollment history when a child changes class', async () => {
    const now = new Date('2026-09-12T03:00:00.000Z')
    await mutateNotebook(
      database,
      teacher,
      {
        commandId: 'change-child-class',
        type: 'updateChild',
        payload: { id: 'c3', expectedVersion: 1, patch: { className: 'つき組（2歳児）' } },
      },
      now,
    )
    expect(
      (await readNotebook(database, teacher)).children.find((child) => child.id === 'c3'),
    ).toMatchObject({
      classId: 'class-f1-tsuki',
      className: 'つき組（2歳児）',
      version: 2,
    })
    expect(
      (
        await database.query<{ ended_on: string | null }>(
          `SELECT ended_on::text AS ended_on
           FROM child_enrollment WHERE child_id = $1
           ORDER BY ended_on NULLS LAST`,
          ['c3'],
        )
      ).rows,
    ).toEqual([{ ended_on: '2026-09-12' }, { ended_on: null }])
  })
})
