import { afterEach, beforeEach, expect, it } from 'vitest'
import { createDatabase, type Database } from '@/lib/db'
import type { User } from '@/lib/types'
import { napMigrationSql } from './nap-schema'
import { mutateNap, readNap } from './nap'

let db: Database
async function execute(sql: string) {
  for (const statement of sql.split(';').filter((s) => s.trim())) await db.query(statement)
}
const user = { id: 't1', role: 'teacher', facilityId: 'f1', name: '先生' } as User
beforeEach(async () => {
  db = await createDatabase({ databaseProvider: 'pglite', pgliteDataDir: 'memory://' })
  await execute(`CREATE TABLE facility(id text PRIMARY KEY);
    CREATE TABLE app_user(id text PRIMARY KEY, name text);
    CREATE TABLE child(id text PRIMARY KEY, facility_id text, name text, admitted_on date, withdrawn_on date, UNIQUE(facility_id,id));
    CREATE TABLE nursery_class(id text PRIMARY KEY, facility_id text, name text);
    CREATE TABLE child_enrollment(child_id text, class_id text, started_on date, ended_on date);
    INSERT INTO facility VALUES ('f1'),('f2'); INSERT INTO app_user VALUES ('t1','先生');
    INSERT INTO child VALUES ('c1','f1','園児',null,null),('c2','f2','別施設',null,null),('c3','f1','退園',null,'2020-01-01');
    INSERT INTO nursery_class VALUES ('cl1','f1','ひよこ'); INSERT INTO child_enrollment VALUES ('c1','cl1',null,null);`)
  await execute(napMigrationSql)
})
afterEach(async () => {
  await db.close()
})
const mutate = (type: string, payload: object) =>
  db.transaction((tx) => mutateNap(tx, user, { type, payload }))
async function start() {
  await mutate('start', { childId: 'c1', intervalMinutes: 5 })
  return (await readNap(db, user)).sessions[0]
}
it('records explicit observations, raises a concern and requires response before ending', async () => {
  const session = await start()
  await expect(mutate('observe', { sessionId: session.id, version: 1 })).rejects.toThrow(
    'InvalidInput',
  )
  await mutate('observe', {
    sessionId: session.id,
    version: 1,
    posture: 'side',
    breathing: 'concern',
    note: '呼吸を再確認',
  })
  await expect(mutate('end', { sessionId: session.id, version: 2 })).rejects.toThrow('Conflict')
  await mutate('respond', {
    sessionId: session.id,
    version: 2,
    response: '応援職員と確認し対応済み',
  })
  await mutate('end', { sessionId: session.id, version: 3 })
  const data = await readNap(db, user)
  expect(data.sessions[0]).toMatchObject({ version: 4, needsResponse: false })
  expect(data.sessions[0].endedAt).toBeTruthy()
  expect(data.observations[0]).toMatchObject({
    posture: 'side',
    breathing: 'concern',
    observerName: '先生',
    response: '応援職員と確認し対応済み',
  })
})
it('isolates facilities and rejects inactive children and parent mutations', async () => {
  await expect(mutate('start', { childId: 'c2', intervalMinutes: 5 })).rejects.toThrow('Forbidden')
  await expect(mutate('start', { childId: 'c3', intervalMinutes: 5 })).rejects.toThrow('Forbidden')
  await expect(
    mutateNap(
      db,
      { ...user, role: 'parent' },
      { type: 'start', payload: { childId: 'c1', intervalMinutes: 5 } },
    ),
  ).rejects.toThrow('Forbidden')
  const session = await start()
  await expect(
    db.transaction((tx) =>
      mutateNap(
        tx,
        { ...user, facilityId: 'f2' },
        { type: 'end', payload: { sessionId: session.id, version: 1 } },
      ),
    ),
  ).rejects.toThrow('Forbidden')
  expect((await readNap(db, { ...user, facilityId: 'f2' })).sessions).toEqual([])
})
it('prevents duplicate sessions, stale writes and observations after completion', async () => {
  const session = await start()
  await expect(start()).rejects.toThrow('Conflict')
  await mutate('observe', {
    sessionId: session.id,
    version: 1,
    posture: 'back',
    breathing: 'normal',
    note: '',
  })
  await expect(mutate('end', { sessionId: session.id, version: 1 })).rejects.toThrow('Conflict')
  const observed = (await readNap(db, user)).sessions[0]
  expect(Date.parse(observed.dueAt) - Date.parse(observed.lastObservedAt!)).toBe(300000)
  await mutate('end', { sessionId: session.id, version: 2 })
  await expect(
    mutate('observe', { sessionId: session.id, version: 3, posture: 'back', breathing: 'normal' }),
  ).rejects.toThrow('Conflict')
})
it('requires a note for concerns and does not let normal checks clear unresolved concerns', async () => {
  const session = await start()
  await expect(
    mutate('observe', {
      sessionId: session.id,
      version: 1,
      posture: 'back',
      breathing: 'concern',
      note: '',
    }),
  ).rejects.toThrow('InvalidInput')
  await mutate('observe', {
    sessionId: session.id,
    version: 1,
    posture: 'back',
    breathing: 'concern',
    note: '変化あり',
  })
  await mutate('observe', {
    sessionId: session.id,
    version: 2,
    posture: 'back',
    breathing: 'normal',
    note: '',
  })
  expect((await readNap(db, user)).sessions[0].needsResponse).toBe(true)
  await mutate('respond', { sessionId: session.id, version: 3, response: '確認して対応を記録' })
  expect((await readNap(db, user)).sessions[0].needsResponse).toBe(false)
})

it('serializes competing observations and records server time rather than caller time', async () => {
  const session = await start()
  const payload = {
    sessionId: session.id,
    version: 1,
    posture: 'back',
    breathing: 'normal',
    observedAt: '2000-01-01T00:00:00Z',
  }
  const result = await Promise.allSettled([mutate('observe', payload), mutate('observe', payload)])
  expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
  expect(result.filter((item) => item.status === 'rejected')).toHaveLength(1)
  const data = await readNap(db, user)
  expect(data.observations).toHaveLength(1)
  expect(Date.parse(data.observations[0].observedAt)).toBeGreaterThan(Date.now() - 60000)
  expect(data.sessions[0].version).toBe(2)
})

it('uses stored due dates and shows overdue active sessions beyond the history window', async () => {
  const session = await start()
  await db.query(
    "UPDATE nap_session SET started_at=now()-interval '8 days',due_at=now()-interval '1 minute' WHERE id=$1",
    [session.id],
  )
  const data = await readNap(db, user)
  expect(data.sessions).toHaveLength(1)
  expect(Date.parse(data.sessions[0].dueAt)).toBeLessThan(Date.now())
  await mutate('end', { sessionId: session.id, version: 1 })
  expect((await readNap(db, user)).sessions).toHaveLength(1)
  await db.query('UPDATE nap_session SET ended_at=started_at WHERE id=$1', [session.id])
  expect((await readNap(db, user)).sessions).toHaveLength(0)
})

it('hides future admissions and rejects invalid intervals and response text', async () => {
  await db.query(
    "UPDATE child SET admitted_on=(now() AT TIME ZONE 'Asia/Tokyo')::date+1 WHERE id='c1'",
  )
  expect((await readNap(db, user)).children).toHaveLength(0)
  await expect(start()).rejects.toThrow('Forbidden')
  await expect(mutate('start', { childId: 'c1', intervalMinutes: 0 })).rejects.toThrow(
    'InvalidInput',
  )
  await expect(
    mutate('respond', { sessionId: 'anything', version: 1, response: ' ' }),
  ).rejects.toThrow('InvalidInput')
})

it('rejects response to an old concern snapshot when another concern arrives', async () => {
  const session = await start()
  await mutate('observe', {
    sessionId: session.id,
    version: 1,
    posture: 'back',
    breathing: 'concern',
    note: '最初の懸念',
  })
  const snapshot = (await readNap(db, user)).sessions[0]
  await mutate('observe', {
    sessionId: session.id,
    version: 2,
    posture: 'back',
    breathing: 'concern',
    note: '追加の懸念',
  })
  await expect(
    mutate('respond', {
      sessionId: session.id,
      version: snapshot.version,
      response: '最初の懸念への対応',
    }),
  ).rejects.toThrow('Conflict')
  const data = await readNap(db, user)
  expect(data.sessions[0].needsResponse).toBe(true)
  expect(data.observations.filter((item) => item.response === null)).toHaveLength(2)
})
