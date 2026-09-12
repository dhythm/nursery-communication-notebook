import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from '@/lib/db'
import { seedNotebook } from '@/lib/repository'
import { users } from '@/lib/mock-data'
import { mutateOperations, readOperations } from './service'

let database: Database
const teacher = users.find((user) => user.role === 'teacher')!
const parent = users.find((user) => user.role === 'parent')!
beforeAll(async () => {
  database = await createDatabase({ databaseProvider: 'pglite', pgliteDataDir: 'memory://' })
  await migrateDatabase(database)
  await seedNotebook(database)
}, 20000)
afterAll(async () => {
  await database?.close()
})

describe('staff operations with normalized facility data', () => {
  it('opens all four empty work areas after migration without sample operational records', async () => {
    expect(await readOperations(database, teacher, 'risks')).toEqual([])
    expect(await readOperations(database, teacher, 'plans')).toEqual([])
    expect(await readOperations(database, teacher, 'attendance')).toMatchObject({ sessions: [] })
    expect(await readOperations(database, teacher, 'nap')).toMatchObject({
      sessions: [],
      observations: [],
    })
  })
  it('commits a mutation and its audit once on retry, with the created entity id', async () => {
    const command = { commandId: 'attendance-integrated', type: 'clock_in', payload: {} }
    await mutateOperations(database, teacher, 'attendance', command)
    await mutateOperations(database, teacher, 'attendance', command)
    const sessions = await database.query<{ id: string }>('SELECT id FROM staff_attendance_session')
    expect(sessions.rows).toHaveLength(1)
    const audit = await database.query('SELECT entity_id FROM audit_log WHERE entity_type=$1', [
      'attendance',
    ])
    expect(audit.rows).toEqual([{ entity_id: sessions.rows[0].id }])
  })
  it('rolls back the command receipt when a state transition fails', async () => {
    const target = async () => {
      const result = await database.query<{ id: string; version: number }>(
        'SELECT id,version FROM staff_attendance_session WHERE clock_out IS NULL',
      )
      return { sessionId: result.rows[0].id, version: result.rows[0].version }
    }
    const command = { commandId: 'failed-integrated', type: 'break_end', payload: await target() }
    await expect(mutateOperations(database, teacher, 'attendance', command)).rejects.toThrow(
      'Conflict',
    )
    expect(
      (
        await database.query(
          "SELECT * FROM mutation_receipt WHERE command_id LIKE '%failed-integrated'",
        )
      ).rows,
    ).toEqual([])
    await mutateOperations(database, teacher, 'attendance', {
      commandId: 'break-integrated',
      type: 'break_start',
      payload: await target(),
    })
    await mutateOperations(database, teacher, 'attendance', { ...command, payload: await target() })
    await mutateOperations(database, teacher, 'attendance', {
      commandId: 'end-integrated',
      type: 'clock_out',
      payload: await target(),
    })
  })
  it('denies parent reads and writes without creating operational records', async () => {
    await expect(readOperations(database, parent, 'nap')).rejects.toThrow('Forbidden')
    await expect(
      mutateOperations(database, parent, 'risks', {
        commandId: 'parent',
        type: 'create',
        payload: {},
      }),
    ).rejects.toThrow('Forbidden')
  })
  it('rechecks revoked and future memberships against the DB', async () => {
    await database.query(
      'UPDATE facility_membership SET started_on=CURRENT_DATE+1 WHERE user_id=$1',
      [teacher.id],
    )
    await expect(readOperations(database, teacher, 'plans')).rejects.toThrow('Forbidden')
    await database.query(
      'UPDATE facility_membership SET started_on=NULL,ended_on=CURRENT_DATE WHERE user_id=$1',
      [teacher.id],
    )
    await expect(readOperations(database, teacher, 'risks')).rejects.toThrow('Forbidden')
    await database.query('UPDATE facility_membership SET ended_on=NULL WHERE user_id=$1', [
      teacher.id,
    ])
  })
  it('does not trust a forged facility or manager permission', async () => {
    await expect(
      readOperations(database, { ...teacher, facilityId: 'unknown' }, 'attendance'),
    ).rejects.toThrow('Forbidden')
    await database.query(
      'UPDATE facility_membership SET can_manage_facility=false WHERE user_id=$1',
      [teacher.id],
    )
    const result = await readOperations(
      database,
      { ...teacher, canManageFacility: true },
      'attendance',
    )
    expect(result).toMatchObject({ canManage: false })
  })
})
