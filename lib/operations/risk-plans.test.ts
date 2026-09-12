import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type Database } from '@/lib/db'
import type { User } from '@/lib/types'
import { riskPlanMigrationSql } from './risk-plans-schema'
import { mutatePlans, mutateRisks, readPlans, readRisks } from './risk-plans'

let db: Database
const teacher: User = {
  id: 'teacher',
  role: 'teacher',
  name: '先生',
  email: 'a@example.test',
  facilityId: 'f',
  facilitySlug: 'f',
}
const manager = { ...teacher, canManageFacility: true }
const risk = {
  occurredAt: '2026-09-12T01:00:00.000Z',
  kind: 'near_miss',
  severity: 'low',
  childId: 'child',
  detail: '床が濡れていた',
  response: '',
  prevention: '',
}
const plan = {
  classId: 'class',
  period: 'weekly',
  startDate: '2026-09-14',
  endDate: '2026-09-20',
  goals: '秋を感じる',
  activities: '散歩',
  support: '個別に声をかける',
}

beforeEach(async () => {
  db = await createDatabase({ databaseProvider: 'pglite', pgliteDataDir: 'memory://' })
  await runSql(
    `CREATE TABLE facility (id text PRIMARY KEY); CREATE TABLE app_user (id text PRIMARY KEY); CREATE TABLE child (id text PRIMARY KEY, facility_id text, UNIQUE(facility_id,id)); CREATE TABLE nursery_class (id text PRIMARY KEY, facility_id text, UNIQUE(facility_id,id)); INSERT INTO facility VALUES ('f'),('other'); INSERT INTO app_user VALUES ('teacher'); INSERT INTO child VALUES ('child','f'),('foreign-child','other'); INSERT INTO nursery_class VALUES ('class','f'),('foreign-class','other');`,
  )
  await runSql(riskPlanMigrationSql)
})
async function runSql(sql: string) {
  for (const statement of sql.split(';').filter((part) => part.trim())) await db.query(statement)
}
afterEach(async () => {
  await db.close()
})

async function riskCommand(type: string, payload: unknown) {
  return db.transaction((tx) => mutateRisks(tx, teacher, { type, payload }))
}
async function planCommand(type: string, payload: unknown, actor = teacher) {
  return db.transaction((tx) => mutatePlans(tx, actor, { type, payload }))
}

describe('risk reports', () => {
  it('persists reports and requires response and prevention to resolve', async () => {
    await riskCommand('create', risk)
    const [record] = await readRisks(db, teacher)
    expect(record.status).toBe('open')
    await expect(riskCommand('resolve', { id: record.id, version: 1 })).rejects.toThrow(
      'InvalidInput',
    )
    await riskCommand('update', {
      ...risk,
      id: record.id,
      version: 1,
      response: '床を拭いた',
      prevention: '水場を点検',
    })
    await expect(riskCommand('resolve', { id: record.id, version: 1 })).rejects.toThrow('Conflict')
    await riskCommand('resolve', { id: record.id, version: 2 })
    expect((await readRisks(db, teacher))[0].status).toBe('resolved')
    await expect(riskCommand('update', { ...risk, id: record.id, version: 3 })).rejects.toThrow(
      'Conflict',
    )
    await riskCommand('reopen', { id: record.id, version: 3 })
    expect((await readRisks(db, teacher))[0].status).toBe('open')
  })
  it('rejects foreign child references and isolates facilities', async () => {
    await expect(riskCommand('create', { ...risk, childId: 'foreign-child' })).rejects.toThrow(
      'Forbidden',
    )
    await riskCommand('create', risk)
    expect(await readRisks(db, { ...teacher, facilityId: 'other' })).toEqual([])
    const [record] = await readRisks(db, teacher)
    await expect(
      db.transaction((tx) =>
        mutateRisks(
          tx,
          { ...teacher, facilityId: 'other' },
          { type: 'resolve', payload: { id: record.id, version: 1 } },
        ),
      ),
    ).rejects.toThrow('Forbidden')
  })
})

describe('instruction plans', () => {
  it('enforces submit, manager approval, evaluation and reusable drafts', async () => {
    await planCommand('create', plan)
    const [record] = await readPlans(db, teacher)
    await expect(planCommand('approve', { id: record.id, version: 1 }, manager)).rejects.toThrow(
      'Conflict',
    )
    await planCommand('submit', { id: record.id, version: 1 })
    await expect(planCommand('approve', { id: record.id, version: 2 })).rejects.toThrow('Forbidden')
    await expect(planCommand('update', { ...plan, id: record.id, version: 2 })).rejects.toThrow(
      'Conflict',
    )
    await planCommand('approve', { id: record.id, version: 2 }, manager)
    await planCommand('evaluate', {
      id: record.id,
      version: 3,
      evaluation: '自然への関心が広がった',
    })
    await planCommand('copy', {
      id: record.id,
      version: 4,
      startDate: '2026-09-21',
      endDate: '2026-09-27',
    })
    const records = await readPlans(db, teacher)
    expect(records).toHaveLength(2)
    expect(records.find((item) => item.id !== record.id)).toMatchObject({
      status: 'draft',
      goals: plan.goals,
      evaluation: '',
      startDate: '2026-09-21',
    })
  })
  it('returns submissions with a reason and rejects invalid periods and cross-facility classes', async () => {
    await expect(planCommand('create', { ...plan, startDate: '2026-09-22' })).rejects.toThrow(
      'InvalidInput',
    )
    await expect(planCommand('create', { ...plan, startDate: '2026-02-30' })).rejects.toThrow(
      'InvalidInput',
    )
    await expect(planCommand('create', { ...plan, classId: 'foreign-class' })).rejects.toThrow(
      'Forbidden',
    )
    await planCommand('create', plan)
    const [record] = await readPlans(db, teacher)
    await planCommand('submit', { id: record.id, version: 1 })
    await expect(
      planCommand('return', { id: record.id, version: 2, reviewComment: '' }, manager),
    ).rejects.toThrow('InvalidInput')
    await planCommand(
      'return',
      { id: record.id, version: 2, reviewComment: '援助を具体的に' },
      manager,
    )
    expect((await readPlans(db, teacher))[0]).toMatchObject({
      status: 'draft',
      reviewComment: '援助を具体的に',
    })
    await expect(planCommand('update', { ...plan, id: record.id, version: 2 })).rejects.toThrow(
      'Conflict',
    )
  })
})

describe('operation boundaries', () => {
  it('rejects parent access to both reads and writes', async () => {
    const parent: User = { ...teacher, role: 'parent' }
    await expect(readRisks(db, parent)).rejects.toThrow('Forbidden')
    await expect(readPlans(db, parent)).rejects.toThrow('Forbidden')
    await expect(mutateRisks(db, parent, { type: 'create', payload: risk })).rejects.toThrow(
      'Forbidden',
    )
    await expect(mutatePlans(db, parent, { type: 'create', payload: plan })).rejects.toThrow(
      'Forbidden',
    )
  })
  it('rejects future incident timestamps and missing occurrence details', async () => {
    await expect(
      riskCommand('create', { ...risk, occurredAt: '2999-01-01T00:00:00Z' }),
    ).rejects.toThrow('InvalidInput')
    await expect(riskCommand('create', { ...risk, detail: ' ' })).rejects.toThrow('InvalidInput')
    expect(await readRisks(db, teacher)).toEqual([])
  })
  it('prevents foreign plan reads, transitions and copying', async () => {
    await planCommand('create', plan)
    const [record] = await readPlans(db, teacher)
    const outsider = { ...manager, facilityId: 'other' }
    expect(await readPlans(db, outsider)).toEqual([])
    await expect(
      planCommand(
        'copy',
        { id: record.id, version: 1, startDate: '2026-09-21', endDate: '2026-09-27' },
        outsider,
      ),
    ).rejects.toThrow('Forbidden')
    await expect(planCommand('approve', { id: record.id, version: 1 }, outsider)).rejects.toThrow(
      'Forbidden',
    )
  })
  it('allows partial drafts, requires completed submission and validates period bounds', async () => {
    await planCommand('create', { ...plan, goals: '', support: '' })
    const [record] = await readPlans(db, teacher)
    await expect(planCommand('submit', { id: record.id, version: 1 })).rejects.toThrow(
      'InvalidInput',
    )
    await expect(
      planCommand('evaluate', { id: record.id, version: 1, evaluation: 'test' }),
    ).rejects.toThrow('Conflict')
    await expect(planCommand('create', { ...plan, period: 'daily' })).rejects.toThrow(
      'InvalidInput',
    )
    await expect(planCommand('create', { ...plan, endDate: '2026-09-21' })).rejects.toThrow(
      'InvalidInput',
    )
    await expect(
      planCommand('create', { ...plan, period: 'monthly', endDate: '2026-10-01' }),
    ).rejects.toThrow('InvalidInput')
    await planCommand('update', { ...plan, id: record.id, version: 1 })
    await planCommand('submit', { id: record.id, version: 2 })
    expect((await readPlans(db, teacher))[0]).toMatchObject({
      status: 'submitted',
      goals: plan.goals,
    })
  })
})
