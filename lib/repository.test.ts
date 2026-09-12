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
    expect(
      (
        await database.query(
          `SELECT sender_user_id, command_id FROM message WHERE body = '検証メッセージ'`,
        )
      ).rows,
    ).toEqual([{ sender_user_id: parent.id, command_id: 'message-once' }])
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
        mood: 'good' as const,
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
        commandId: 'invalid-bedtime',
        payload: { ...entry.payload, bedtime: '25:00' },
      }),
    ).rejects.toThrow()
    await expect(
      mutateNotebook(database, parent, {
        ...entry,
        commandId: 'invalid-stool-count',
        payload: { ...entry.payload, morningStoolCount: 11 },
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
        mood: 'good' as const,
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

  it('keeps a notebook draft private, publishes it, and records its history once', async () => {
    const command = {
      commandId: 'parent-c2-draft',
      type: 'saveNotebookEntry' as const,
      payload: {
        childId: 'c2',
        mood: 'normal' as const,
        temperature: '36.6',
        meals: '朝食',
        nap: '8時間',
        toilet: '通常',
        note: '下書き内容',
        eveningMeal: 'ご飯、焼き魚、みそ汁',
        bedtime: '21:00',
        eveningStool: 'normal' as const,
        eveningStoolCount: 1,
        wakeTime: '06:30',
        morningStool: 'none' as const,
        morningStoolCount: 0,
        breakfast: 'トースト、バナナ、牛乳',
        temperatureMeasuredAt: '07:00',
        condition: '元気に過ごしています',
        pickupPerson: 'mother' as const,
        pickupPersonName: '',
        pickupTime: '17:30',
        status: 'draft' as const,
      },
    }
    await mutateNotebook(database, parent, command)
    await mutateNotebook(database, parent, command)
    const draft = (await readNotebook(database, parent)).notebookEntries.find(
      (entry) => entry.note === '下書き内容',
    )!
    expect(draft).toMatchObject({
      status: 'draft',
      eveningMeal: 'ご飯、焼き魚、みそ汁',
      bedtime: '21:00',
      eveningStool: 'normal',
      eveningStoolCount: 1,
      wakeTime: '06:30',
      morningStool: 'none',
      morningStoolCount: 0,
      breakfast: 'トースト、バナナ、牛乳',
      temperatureMeasuredAt: '07:00',
      condition: '元気に過ごしています',
      pickupPerson: 'mother',
      pickupTime: '17:30',
    })
    expect(
      (await readNotebook(database, teacher)).notebookEntries.some(
        (entry) => entry.id === draft.id,
      ),
    ).toBe(false)

    await mutateNotebook(database, parent, {
      commandId: 'parent-c2-publish',
      type: 'updateNotebookEntry',
      payload: { id: draft.id, expectedVersion: draft.version!, patch: { status: 'published' } },
    })
    expect(
      (await readNotebook(database, teacher)).notebookEntries.find(
        (entry) => entry.id === draft.id,
      ),
    ).toMatchObject({ status: 'published', version: 2 })
    expect(
      (
        await database.query(
          'SELECT action FROM audit_log WHERE entity_id = $1 ORDER BY occurred_at',
          [draft.id],
        )
      ).rows,
    ).toEqual([{ action: 'draft_saved' }, { action: 'published' }])
  })

  it('locks a parent notebook entry after a teacher confirms it', async () => {
    const entry = (await readNotebook(database, teacher)).notebookEntries.find(
      (candidate) => candidate.id === 'n2',
    )!

    await mutateNotebook(database, teacher, {
      commandId: 'confirm-parent-notebook',
      type: 'confirmNotebookEntry',
      payload: { id: entry.id, expectedVersion: entry.version! },
    })

    expect(
      (await readNotebook(database, parent)).notebookEntries.find(
        (candidate) => candidate.id === entry.id,
      ),
    ).toMatchObject({
      confirmedAt: expect.any(String),
      confirmedByName: teacher.name,
      version: entry.version! + 1,
    })
    await expect(
      mutateNotebook(database, parent, {
        commandId: 'edit-confirmed-parent-notebook',
        type: 'updateNotebookEntry',
        payload: {
          id: entry.id,
          expectedVersion: entry.version! + 1,
          patch: { note: '確認後の変更' },
        },
      }),
    ).rejects.toThrow('Locked')
    await expect(
      mutateNotebook(database, parent, {
        commandId: 'withdraw-confirmed-parent-notebook',
        type: 'withdrawNotebookEntry',
        payload: { id: entry.id, expectedVersion: entry.version! + 1 },
      }),
    ).rejects.toThrow('Locked')
  })

  it('publishes a targeted notice and persists read and confirmation state', async () => {
    await mutateNotebook(database, teacher, {
      commandId: 'important-notice',
      type: 'saveNotice',
      payload: {
        title: '確認が必要です',
        body: '本文',
        category: '重要',
        pinned: true,
        requiresConfirmation: true,
        targetClassId: 'class-f1-sora',
        status: 'published',
      },
    })
    const notice = (await readNotebook(database, parent)).notices.find(
      (candidate) => candidate.title === '確認が必要です',
    )!
    expect(notice).toMatchObject({ recipientCount: 1, readCount: 0, confirmationCount: 0 })
    await mutateNotebook(database, parent, {
      commandId: 'read-important-notice',
      type: 'markNoticeRead',
      payload: { id: notice.id },
    })
    await mutateNotebook(database, parent, {
      commandId: 'confirm-important-notice',
      type: 'confirmNotice',
      payload: { id: notice.id },
    })
    expect(
      (await readNotebook(database, parent)).notices.find(
        (candidate) => candidate.id === notice.id,
      ),
    ).toMatchObject({ readAt: expect.any(String), confirmedAt: expect.any(String) })
  })

  it('persists notification preferences and protects notification ownership', async () => {
    expect((await readNotebook(database, teacher)).notificationPreferences).toContainEqual({
      category: 'notebook',
      enabled: false,
    })
    await mutateNotebook(database, teacher, {
      commandId: 'enable-notebook-notification',
      type: 'updateNotificationPreference',
      payload: { category: 'notebook', enabled: true },
    })
    expect((await readNotebook(database, teacher)).notificationPreferences).toContainEqual({
      category: 'notebook',
      enabled: true,
    })
    const notification = (await readNotebook(database, parent)).notifications[0]
    if (notification) {
      await expect(
        mutateNotebook(database, teacher, {
          commandId: 'read-someone-elses-notification',
          type: 'markNotificationRead',
          payload: { id: notification.id },
        }),
      ).rejects.toThrow('Forbidden')
    }
  })

  it('edits and cancels a calendar event with optimistic concurrency', async () => {
    await mutateNotebook(database, teacher, {
      commandId: 'event-to-edit',
      type: 'addEvent',
      payload: {
        facilityId: teacher.facilityId,
        date: '2026-10-01',
        title: '変更前',
        type: '行事',
      },
    })
    const event = (await readNotebook(database, teacher)).calendarEvents.find(
      (candidate) => candidate.title === '変更前',
    )!
    await mutateNotebook(database, teacher, {
      commandId: 'edit-event',
      type: 'updateEvent',
      payload: { id: event.id, expectedVersion: event.version!, patch: { title: '変更後' } },
    })
    await expect(
      mutateNotebook(database, teacher, {
        commandId: 'stale-event',
        type: 'updateEvent',
        payload: { id: event.id, expectedVersion: event.version!, patch: { title: '競合' } },
      }),
    ).rejects.toThrow('Conflict')
    await mutateNotebook(database, teacher, {
      commandId: 'cancel-event',
      type: 'cancelEvent',
      payload: { id: event.id, expectedVersion: 2 },
    })
    expect(
      (await readNotebook(database, teacher)).calendarEvents.some(
        (candidate) => candidate.id === event.id,
      ),
    ).toBe(false)
  })

  it('filters searchable feeds in the database and applies pagination', async () => {
    const result = await readNotebook(database, parent, {
      search: '運動会',
      from: '2026-09-01',
      to: '2026-09-30',
      limit: 1,
    })
    expect(result.notices).toHaveLength(1)
    expect(result.notices[0].title).toContain('運動会')
    expect(result.notebookEntries).toHaveLength(0)
  })

  it('runs admission, class assignment, guardian linking, staff assignment, and withdrawal', async () => {
    await mutateNotebook(database, teacher, {
      commandId: 'create-class-management',
      type: 'createClass',
      payload: { name: 'ほし組（1歳児）', schoolYear: 2026 },
    })
    await mutateNotebook(database, teacher, {
      commandId: 'create-guardian-management',
      type: 'createMember',
      payload: { name: '新規 保護者', email: 'new-parent@example.com', role: 'parent' },
    })
    await mutateNotebook(database, teacher, {
      commandId: 'create-staff-management',
      type: 'createMember',
      payload: {
        name: '新規 職員',
        email: 'new-teacher@example.com',
        role: 'teacher',
        jobTitle: '担任',
      },
    })
    let management = await readNotebook(database, teacher)
    const nurseryClass = management.nurseryClasses.find((item) => item.name === 'ほし組（1歳児）')!
    const guardian = management.members.find((member) => member.email === 'new-parent@example.com')!
    const staff = management.members.find((member) => member.email === 'new-teacher@example.com')!
    await mutateNotebook(database, teacher, {
      commandId: 'admit-child-management',
      type: 'createChild',
      payload: {
        name: '新規 園児',
        kana: 'しんき えんじ',
        birthday: '2025-04-01',
        classId: nurseryClass.id,
        avatarColor: 'blue',
        allergies: [],
        notes: '',
        guardianUserIds: [guardian.id],
      },
    })
    management = await readNotebook(database, teacher)
    const child = management.children.find((item) => item.name === '新規 園児')!
    expect(
      (
        await readNotebook(database, {
          id: guardian.id,
          role: 'parent',
          name: guardian.name,
          email: guardian.email,
          facilityId: teacher.facilityId,
          facilitySlug: teacher.facilitySlug,
        })
      ).children.map((item) => item.id),
    ).toEqual([child.id])
    await mutateNotebook(database, teacher, {
      commandId: 'assign-staff-management',
      type: 'assignStaffClass',
      payload: { staffUserId: staff.id, classId: nurseryClass.id },
    })
    await mutateNotebook(database, teacher, {
      commandId: 'move-child-management',
      type: 'moveChildClass',
      payload: { id: child.id, expectedVersion: child.version!, classId: 'class-f1-tsuki' },
    })
    management = await readNotebook(database, teacher)
    expect(management.children.find((item) => item.id === child.id)).toMatchObject({
      classId: 'class-f1-tsuki',
      version: 2,
    })
    expect(management.members.find((member) => member.id === staff.id)?.assignedClassIds).toContain(
      nurseryClass.id,
    )
    await mutateNotebook(database, teacher, {
      commandId: 'end-staff-management',
      type: 'endMembership',
      payload: { userId: staff.id, role: 'teacher' },
    })
    await mutateNotebook(database, teacher, {
      commandId: 'withdraw-child-management',
      type: 'withdrawChild',
      payload: { id: child.id, expectedVersion: 2 },
    })
    management = await readNotebook(database, teacher)
    expect(management.children.some((item) => item.id === child.id)).toBe(false)
    expect(management.members.some((member) => member.id === staff.id)).toBe(false)
  })
})
