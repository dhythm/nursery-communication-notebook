import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from './db'
import { LocalFileStorage } from './file-storage'
import { getSharedFile, uploadSharedFile } from './file-repository'
import { seedNotebook, readNotebook } from './repository'
import { users } from './mock-data'

let database: Database
let directory: string
const teacher = users.find((user) => user.role === 'teacher')!
const parent = users.find((user) => user.role === 'parent')!

beforeAll(async () => {
  database = await createDatabase({ databaseProvider: 'pglite', pgliteDataDir: 'memory://' })
  await migrateDatabase(database)
  await seedNotebook(database)
  directory = await mkdtemp(join(tmpdir(), 'nursery-file-repository-'))
})
afterAll(async () => {
  await database.close()
  await rm(directory, { recursive: true, force: true })
})

describe('shared file repository', () => {
  it('stores real bytes and lists an authorized class file', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\nfile body')
    const storage = new LocalFileStorage(directory)
    const id = await uploadSharedFile(database, storage, teacher, {
      fileName: 'guide.pdf',
      displayName: '行事資料',
      bytes,
      commandId: 'upload-guide',
      targetClassId: 'class-f1-sora',
    })
    expect(await storage.get(`${teacher.facilityId}/${id}`)).toEqual(bytes)
    expect((await readNotebook(database, parent)).sharedFiles).toContainEqual(
      expect.objectContaining({ id, name: '行事資料', byteSize: bytes.length }),
    )
    expect(await getSharedFile(database, parent, id)).toMatchObject({
      content_type: 'application/pdf',
    })
    expect(
      await uploadSharedFile(database, storage, teacher, {
        fileName: 'guide.pdf',
        displayName: '行事資料',
        bytes,
        commandId: 'upload-guide',
        targetClassId: 'class-f1-sora',
      }),
    ).toBe(id)
  })

  it('rejects parent uploads', async () => {
    await expect(
      uploadSharedFile(database, new LocalFileStorage(directory), parent, {
        fileName: 'guide.pdf',
        displayName: '不可',
        bytes: new TextEncoder().encode('%PDF-x'),
        commandId: 'parent-upload',
      }),
    ).rejects.toThrow('Forbidden')
  })

  it('allows a parent photo only for their own child', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00])
    const storage = new LocalFileStorage(directory)
    const id = await uploadSharedFile(database, storage, parent, {
      fileName: 'today.jpg',
      displayName: '今日の写真',
      bytes,
      commandId: 'parent-photo',
      targetChildId: 'c1',
      purpose: 'notebook',
    })
    expect(await getSharedFile(database, parent, id)).toBeDefined()
    await expect(
      uploadSharedFile(database, storage, parent, {
        fileName: 'other.jpg',
        displayName: '対象外',
        bytes,
        commandId: 'other-photo',
        targetChildId: 'c3',
        purpose: 'notebook',
      }),
    ).rejects.toThrow('Forbidden')
  })
})
