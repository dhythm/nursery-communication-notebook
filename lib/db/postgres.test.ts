import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, getDatabase } from './index'

const connection = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  release: vi.fn(),
}))
const pool = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  connect: vi.fn(),
  end: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
}))
vi.mock('pg', () => ({
  Pool: class {
    constructor() {
      return pool
    }
  },
}))
vi.mock('../runtime-config', () => ({
  getRuntimeConfig: () => ({
    databaseProvider: 'postgres',
    databaseUrl: 'postgresql://localhost/nursery',
    pgliteDataDir: 'memory://',
  }),
}))

const config = {
  databaseProvider: 'postgres' as const,
  databaseUrl: 'postgresql://localhost/nursery',
  pgliteDataDir: 'memory://',
}

beforeEach(() => {
  vi.clearAllMocks()
  pool.connect.mockResolvedValue(connection)
  delete (globalThis as typeof globalThis & { nurseryDatabase?: unknown }).nurseryDatabase
})

describe('PostgreSQL database', () => {
  it('runs the whole transaction on a checked-out client and releases it', async () => {
    const database = await createDatabase(config)
    const value = await database.transaction(async (transaction) => {
      await transaction.query('SELECT $1 AS value', ['hello'])
      return 'committed'
    })
    expect(value).toBe('committed')
    expect(connection.query.mock.calls).toEqual([
      ['BEGIN'],
      ['SELECT $1 AS value', ['hello']],
      ['COMMIT'],
    ])
    expect(connection.release).toHaveBeenCalledOnce()
    expect(pool.query).toHaveBeenCalledExactlyOnceWith('SELECT 1')
    await database.close()
  })

  it('rolls back failed transactions and releases the checked-out client', async () => {
    const database = await createDatabase(config)
    await expect(
      database.transaction(async () => {
        throw new Error('Abort')
      }),
    ).rejects.toThrow('Abort')
    expect(connection.query.mock.calls).toEqual([['BEGIN'], ['ROLLBACK']])
    expect(connection.release).toHaveBeenCalledOnce()
    await database.close()
  })

  it('closes the pool when its initial connection fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('Connection failed'))
    await expect(createDatabase(config)).rejects.toThrow('Connection failed')
    expect(pool.end).toHaveBeenCalledOnce()
  })

  it('discards a broken client when rollback fails and preserves the original error', async () => {
    const database = await createDatabase(config)
    connection.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('Connection lost'))
    await expect(
      database.transaction(async () => {
        throw new Error('Original failure')
      }),
    ).rejects.toThrow('Original failure')
    expect(connection.release).toHaveBeenCalledExactlyOnceWith(true)
    await database.close()
  })

  it('shares a connection promise across requests and module reloads', async () => {
    const first = getDatabase()
    expect(getDatabase()).toBe(first)
    vi.resetModules()
    const reloaded = await import('./index')
    expect(reloaded.getDatabase()).toBe(first)
    await (await first).close()
  })

  it('retries singleton initialization after a connection failure', async () => {
    pool.query.mockRejectedValueOnce(new Error('Unavailable'))
    await expect(getDatabase()).rejects.toThrow('Unavailable')
    const database = await getDatabase()
    expect(pool.query).toHaveBeenCalledTimes(2)
    await database.close()
  })
})
