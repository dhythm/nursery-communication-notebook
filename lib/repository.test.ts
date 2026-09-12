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
  it('stores a message, derives the author and preserves it on reseed', async () => {
    await mutateNotebook(database, parent, {
      type: 'addMessage',
      payload: {
        childId: 'c1',
        sender: 'teacher',
        senderName: 'spoofed',
        text: '検証メッセージ',
        time: '2026-09-12T09:00:00',
      },
    })
    await seedNotebook(database)
    const snapshot = await readNotebook(database, parent)
    expect(snapshot.messages.find((message) => message.text === '検証メッセージ')).toMatchObject({
      sender: 'parent',
      senderName: parent.name,
    })
  })
  it('rejects unauthorized child access and teacher-only mutations', async () => {
    await expect(
      mutateNotebook(database, parent, {
        type: 'addMessage',
        payload: {
          childId: 'c3',
          sender: 'parent',
          senderName: parent.name,
          text: 'denied',
          time: '2026-09-12T09:00:00',
        },
      }),
    ).rejects.toThrow(/Forbidden/)
    await expect(
      mutateNotebook(database, parent, {
        type: 'updateChild',
        payload: { id: 'c1', patch: { notes: 'denied' } },
      }),
    ).rejects.toThrow(/Forbidden/)
  })
  it('validates mutation fields and blocks facility reassignment', async () => {
    await expect(
      mutateNotebook(database, teacher, {
        type: 'updateChild',
        payload: { id: 'c1', patch: { facilityId: 'f2' } },
      }),
    ).rejects.toThrow()
    await expect(
      mutateNotebook(database, parent, { type: 'addMessage', payload: { text: '' } }),
    ).rejects.toThrow()
  })
})
