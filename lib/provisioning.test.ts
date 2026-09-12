import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from './db'
import { provisionFacility } from './provisioning'

let database: Database | undefined

afterEach(async () => {
  await database?.close()
  database = undefined
})

describe('facility provisioning', () => {
  it('creates the first facility manager without demo data and is retry safe', async () => {
    database = await createDatabase({
      databaseProvider: 'pglite',
      pgliteDataDir: 'memory://',
    })
    await migrateDatabase(database)

    const input = {
      facilitySlug: 'aozora',
      facilityName: 'あおぞら保育園',
      managerName: '園長 花子',
      managerEmail: 'director@aozora.example',
    }
    const first = await provisionFacility(database, input)
    const retry = await provisionFacility(database, input)

    expect(retry).toEqual(first)
    expect(
      (
        await database.query(
          `SELECT facility.slug, app_user.email, membership.role, membership.can_manage_facility
           FROM facility
           JOIN facility_membership membership ON membership.facility_id = facility.id
           JOIN app_user ON app_user.id = membership.user_id`,
        )
      ).rows,
    ).toEqual([
      {
        slug: 'aozora',
        email: 'director@aozora.example',
        role: 'teacher',
        can_manage_facility: true,
      },
    ])
  }, 15_000)

  it('does not attach a different manager to an existing slug', async () => {
    database = await createDatabase({
      databaseProvider: 'pglite',
      pgliteDataDir: 'memory://',
    })
    await migrateDatabase(database)
    await provisionFacility(database, {
      facilitySlug: 'aozora',
      facilityName: 'あおぞら保育園',
      managerName: '園長 花子',
      managerEmail: 'director@aozora.example',
    })

    await expect(
      provisionFacility(database, {
        facilitySlug: 'aozora',
        facilityName: 'あおぞら保育園',
        managerName: '別の管理者',
        managerEmail: 'other@example.com',
      }),
    ).rejects.toThrow('Facility slug already exists')
  }, 15_000)
})
