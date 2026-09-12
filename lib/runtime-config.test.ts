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

  it('requires Clerk keys for Clerk authentication', () => {
    expect(() => getRuntimeConfig({ ...development, AUTH_MODE: 'clerk' })).toThrow(/CLERK/)
    expect(
      getRuntimeConfig({
        ...development,
        AUTH_MODE: 'clerk',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
        CLERK_SECRET_KEY: 'sk_test_example',
      }),
    ).toMatchObject({ authMode: 'clerk' })
  })

  it('allows production only with Clerk authentication and PostgreSQL', () => {
    expect(() =>
      getRuntimeConfig({
        APP_ENV: 'production',
        AUTH_MODE: 'clerk',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_example',
        CLERK_SECRET_KEY: 'sk_live_example',
        DATABASE_PROVIDER: 'postgres',
        DATABASE_URL: 'postgresql://nursery:secret@db.example.com/nursery',
      }),
    ).toThrow(/S3/)
    expect(
      getRuntimeConfig({
        APP_ENV: 'production',
        AUTH_MODE: 'clerk',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_example',
        CLERK_SECRET_KEY: 'sk_live_example',
        DATABASE_PROVIDER: 'postgres',
        DATABASE_URL: 'postgresql://nursery:secret@db.example.com/nursery',
        FILE_STORAGE_PROVIDER: 's3',
        S3_BUCKET: 'nursery-production-files',
        S3_REGION: 'ap-northeast-1',
      }),
    ).toMatchObject({
      appEnv: 'production',
      authMode: 'clerk',
      databaseProvider: 'postgres',
      fileStorageProvider: 's3',
      s3Bucket: 'nursery-production-files',
    })
  })

  it('supports Auth.js credentials when its secret is configured', () => {
    expect(
      getRuntimeConfig({ ...development, AUTH_MODE: 'authjs', AUTH_SECRET: 'test-secret' }),
    ).toMatchObject({ authMode: 'authjs' })
    expect(() => getRuntimeConfig({ ...development, AUTH_MODE: 'authjs' })).toThrow(/AUTH_SECRET/)
    expect(() =>
      getRuntimeConfig({
        ...development,
        APP_ENV: 'production',
        AUTH_MODE: 'authjs',
        AUTH_SECRET: 'too-short',
        DATABASE_PROVIDER: 'postgres',
        DATABASE_URL: 'postgresql://nursery:secret@db.example.com/nursery',
        FILE_STORAGE_PROVIDER: 's3',
        S3_BUCKET: 'nursery-production-files',
        S3_REGION: 'ap-northeast-1',
      }),
    ).toThrow(/32 characters/)
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
