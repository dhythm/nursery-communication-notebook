import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/db'
import { users } from '@/lib/mock-data'
import { readOperations, mutateOperations } from './service'

const { read, mutate } = vi.hoisted(() => ({ read: vi.fn(), mutate: vi.fn() }))
vi.mock('./attendance', () => ({ readAttendance: read, mutateAttendance: mutate }))
vi.mock('./nap', () => ({ readNap: read, mutateNap: mutate }))
vi.mock('./risk-plans', () => ({
  readRisks: read,
  mutateRisks: mutate,
  readPlans: read,
  mutatePlans: mutate,
}))
const teacher = users.find((user) => user.role === 'teacher')!
const parent = users.find((user) => user.role === 'parent')!
const query = vi.fn()
const database = {
  query,
  transaction: async (callback: (db: { query: typeof query }) => unknown) => callback({ query }),
} as unknown as Database
beforeEach(() => {
  vi.clearAllMocks()
  read.mockResolvedValue({ records: [] })
})

describe('staff operations authorization and receipts', () => {
  it('denies parents before reading domain records', async () => {
    await expect(readOperations(database, parent, 'attendance')).rejects.toThrow('Forbidden')
    expect(read).not.toHaveBeenCalled()
  })
  it('denies revoked memberships even with a stale teacher session', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    await expect(readOperations(database, teacher, 'nap')).rejects.toThrow('Forbidden')
    expect(read).not.toHaveBeenCalled()
  })
  it('derives manager permission from the database rather than the session', async () => {
    query.mockResolvedValueOnce({ rows: [{ can_manage_facility: false }] })
    await readOperations(database, { ...teacher, canManageFacility: true }, 'attendance')
    expect(read).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ canManageFacility: false }),
    )
  })
  it('does not mutate or audit a retried command', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ can_manage_facility: true }] })
      .mockResolvedValueOnce({ rows: [] })
    await mutateOperations(database, teacher, 'attendance', {
      commandId: 'test-retry',
      type: 'clockIn',
      payload: {},
    })
    expect(mutate).not.toHaveBeenCalled()
    expect(query).toHaveBeenCalledTimes(2)
  })
  it('writes an audit record after a successful domain mutation', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ can_manage_facility: true }] })
      .mockResolvedValueOnce({ rows: [{ command_id: 'test' }] })
      .mockResolvedValueOnce({ rows: [] })
    await mutateOperations(database, teacher, 'attendance', {
      commandId: 'test-command',
      type: 'clockIn',
      payload: {},
    })
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[2][0]).toContain('INSERT INTO audit_log')
    expect(query.mock.calls[2][1]).toContain(teacher.facilityId)
  })
  it('does not audit a failed mutation', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ can_manage_facility: false }] })
      .mockResolvedValueOnce({ rows: [{ command_id: 'test' }] })
    mutate.mockRejectedValueOnce(new Error('Conflict'))
    await expect(
      mutateOperations(database, teacher, 'nap', {
        commandId: 'test-conflict',
        type: 'end',
        payload: {},
      }),
    ).rejects.toThrow('Conflict')
    expect(query).toHaveBeenCalledTimes(2)
  })
})
