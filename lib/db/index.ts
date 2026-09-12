import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { getRuntimeConfig, type RuntimeConfig } from '../runtime-config'

export { checkDatabase, migrateDatabase, seedDatabase } from './migrations'

interface QueryExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

export interface Database extends QueryExecutor {
  transaction<T>(callback: (transaction: QueryExecutor) => Promise<T>): Promise<T>
  close(): Promise<void>
}

type DatabaseConfig = Pick<RuntimeConfig, 'databaseProvider' | 'databaseUrl' | 'pgliteDataDir'>

export async function createDatabase(config: DatabaseConfig): Promise<Database> {
  if (config.databaseProvider === 'pglite') {
    const { PGlite } = await import('@electric-sql/pglite')
    if (!config.pgliteDataDir.startsWith('memory://')) {
      await mkdir(dirname(config.pgliteDataDir), { recursive: true })
    }
    const client = await PGlite.create(config.pgliteDataDir)
    return {
      query: (sql, params) => client.query(sql, params),
      transaction: (callback) => client.transaction((transaction) => callback(transaction)),
      close: async () => {
        if (!client.closed) await client.close()
      },
    }
  }

  if (!config.databaseUrl) throw new Error('DATABASE_URL is required for PostgreSQL')
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 10_000 })
  // Pool removes failed idle clients; keep the process alive for subsequent requests.
  pool.on('error', () => console.error('An idle PostgreSQL connection failed'))
  try {
    await pool.query('SELECT 1')
  } catch (error) {
    await pool.end()
    throw error
  }
  let closed = false
  return {
    async query<T>(sql: string, params?: unknown[]) {
      const result = await pool.query(sql, params)
      return { rows: result.rows as T[] }
    },
    async transaction(callback) {
      const client = await pool.connect()
      let discard = false
      try {
        await client.query('BEGIN')
        const result = await callback({
          async query<T>(sql: string, params?: unknown[]) {
            const result = await client.query(sql, params)
            return { rows: result.rows as T[] }
          },
        })
        await client.query('COMMIT')
        return result
      } catch (error) {
        try {
          await client.query('ROLLBACK')
        } catch {
          discard = true
        }
        throw error
      } finally {
        client.release(discard || undefined)
      }
    },
    async close() {
      if (closed) return
      closed = true
      await pool.end()
    },
  }
}

const databaseGlobal = globalThis as typeof globalThis & {
  nurseryDatabase?: Promise<Database>
}

export function getDatabase(): Promise<Database> {
  databaseGlobal.nurseryDatabase ??= createDatabase(getRuntimeConfig()).catch((error) => {
    databaseGlobal.nurseryDatabase = undefined
    throw error
  })
  return databaseGlobal.nurseryDatabase
}
