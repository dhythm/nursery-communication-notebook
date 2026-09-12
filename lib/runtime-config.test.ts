import { describe, expect, it } from 'vitest'
import { getRuntimeConfig } from './runtime-config'

const development = {
  APP_ENV: 'development',
  AUTH_MODE: 'skip',
  DATABASE_PROVIDER: 'pglite',
}

describe('runtime configuration', () => {
  it('requires an explicit development environment for auth skip', () => {
    expect(() => getRuntimeConfig({ AUTH_MODE: 'skip' })).toThrow(/skip/)
    expect(() => getRuntimeConfig({ ...development, APP_ENV: 'production' })).toThrow(/skip/)
    expect(() => getRuntimeConfig({ ...development, VERCEL_ENV: 'production' })).toThrow(/skip/)
  })

  it('allows agent verification of a production build without Clerk or Docker', () => {
    expect(getRuntimeConfig({ ...development, NODE_ENV: 'production' })).toMatchObject({
      appEnv: 'development',
      authMode: 'skip',
      databaseProvider: 'pglite',
      pgliteDataDir: '.data/pglite',
    })
  })

  it('never silently falls back on invalid or missing production settings', () => {
    expect(() => getRuntimeConfig({ ...development, AUTH_MODE: 'skpi' })).toThrow(/AUTH_MODE/)
    expect(() => getRuntimeConfig({ ...development, DATABASE_PROVIDER: 'sqlite' })).toThrow(
      /DATABASE_PROVIDER/,
    )
    expect(() => getRuntimeConfig({ ...development, APP_ENV: 'prod' })).toThrow(/APP_ENV/)
    expect(() => getRuntimeConfig({ ...development, DATABASE_PROVIDER: 'postgres' })).toThrow(
      /DATABASE_URL/,
    )
    expect(() => getRuntimeConfig({})).toThrow(/AUTH_MODE/)
  })

  it('fails closed for future auth providers until they are implemented', () => {
    expect(() => getRuntimeConfig({ ...development, AUTH_MODE: 'clerk' })).toThrow(
      /not implemented/,
    )
  })

  it('rejects invalid PostgreSQL URLs without exposing the secret', () => {
    expect(() =>
      getRuntimeConfig({
        ...development,
        DATABASE_PROVIDER: 'postgres',
        DATABASE_URL: 'https://private:secret@example.com',
      }),
    ).toThrow('DATABASE_URL must be a PostgreSQL connection URL')
  })
})
