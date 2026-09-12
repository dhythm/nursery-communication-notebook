import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from './db'
import { LocalFileStorage } from './file-storage'
import { deleteSharedFile, getSharedFile, uploadSharedFile } from './file-repository'
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

  it('lets a facility teacher unpublish a shared file and delete its stored bytes idempotently', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\ndelete me')
    const storage = new LocalFileStorage(directory)
    const id = await uploadSharedFile(database, storage, teacher, {
      fileName: 'obsolete.pdf',
      displayName: '古い資料',
      bytes,
      commandId: 'upload-obsolete',
    })

    await deleteSharedFile(database, storage, teacher, id, 'delete-obsolete')
    await deleteSharedFile(database, storage, teacher, id, 'delete-obsolete')

    await expect(storage.get(`${teacher.facilityId}/${id}`)).rejects.toThrow()
    expect((await readNotebook(database, teacher)).sharedFiles).not.toContainEqual(
      expect.objectContaining({ id }),
    )
    expect(await getSharedFile(database, teacher, id)).toBeUndefined()
    const row = await database.query<{ status: string; deleted_at: string | null }>(
      'SELECT status, deleted_at::text FROM file_object WHERE id = $1',
      [id],
    )
    expect(row.rows[0]).toMatchObject({ status: 'deleted' })
    expect(row.rows[0]?.deleted_at).not.toBeNull()
    const audits = await database.query<{ action: string }>(
      `SELECT action FROM audit_log WHERE entity_type = 'file' AND entity_id = $1 AND action = 'deleted'`,
      [id],
    )
    expect(audits.rows).toHaveLength(1)
  })

  it('rejects deletion by a parent or a teacher outside the facility', async () => {
    const storage = new LocalFileStorage(directory)
    const id = await uploadSharedFile(database, storage, teacher, {
      fileName: 'private.pdf',
      displayName: '施設内資料',
      bytes: new TextEncoder().encode('%PDF-1.7\nprivate'),
      commandId: 'upload-private',
    })
    const otherFacilityTeacher = {
      ...teacher,
      id: 'outside-teacher',
      facilityId: 'f2',
      facilitySlug: 'himawari',
    }

    await expect(deleteSharedFile(database, storage, parent, id, 'parent-delete')).rejects.toThrow(
      'Forbidden',
    )
    await expect(
      deleteSharedFile(database, storage, otherFacilityTeacher, id, 'outside-delete'),
    ).rejects.toThrow('Forbidden')
    expect(await storage.get(`${teacher.facilityId}/${id}`)).toBeDefined()
    expect(await getSharedFile(database, teacher, id)).toBeDefined()
  })

  it('keeps the file published when deleting its stored bytes fails', async () => {
    const storage = new LocalFileStorage(directory)
    const id = await uploadSharedFile(database, storage, teacher, {
      fileName: 'retry.pdf',
      displayName: '再試行する資料',
      bytes: new TextEncoder().encode('%PDF-1.7\nretry'),
      commandId: 'upload-retry',
    })
    const failingStorage = {
      put: storage.put.bind(storage),
      get: storage.get.bind(storage),
      delete: async () => {
        throw new Error('StorageUnavailable')
      },
    }

    await expect(
      deleteSharedFile(database, failingStorage, teacher, id, 'delete-retry'),
    ).rejects.toThrow('StorageUnavailable')

    expect(await storage.get(`${teacher.facilityId}/${id}`)).toBeDefined()
    expect(await getSharedFile(database, teacher, id)).toBeDefined()
    const row = await database.query<{ status: string }>(
      'SELECT status FROM file_object WHERE id = $1',
      [id],
    )
    expect(row.rows[0]?.status).toBe('available')
    const receipts = await database.query(
      'SELECT 1 FROM mutation_receipt WHERE actor_id = $1 AND command_id = $2',
      [teacher.id, 'delete-retry'],
    )
    expect(receipts.rows).toHaveLength(0)
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
