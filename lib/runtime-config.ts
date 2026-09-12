export interface RuntimeConfig {
  appEnv: 'development' | 'test' | 'production'
  authMode: AuthMode
  databaseProvider: 'postgres' | 'pglite'
  databaseUrl?: string
  pgliteDataDir: string
  fileStorageProvider: 'local' | 's3'
  fileStorageDir: string
  s3Bucket?: string
  s3Region?: string
  s3Endpoint?: string
}

export type AuthMode = 'skip' | 'clerk' | 'authjs'

/** Server configuration. No credentials or environment values are sent to the browser. */
export function getRuntimeConfig(
  environment: Record<string, string | undefined> = process.env,
): RuntimeConfig {
  const appEnv = environment.APP_ENV ?? 'production'
  if (appEnv !== 'development' && appEnv !== 'test' && appEnv !== 'production') {
    throw new Error('APP_ENV must be development, test, or production')
  }
  const authMode = environment.AUTH_MODE
  const production = appEnv === 'production' || environment.VERCEL_ENV === 'production'
  if (authMode !== 'skip' && authMode !== 'clerk' && authMode !== 'authjs') {
    throw new Error('AUTH_MODE must be skip, clerk, or authjs')
  }
  if (production && authMode === 'skip') {
    throw new Error('Authentication skip is forbidden in production')
  }
  if (
    authMode === 'clerk' &&
    (!environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !environment.CLERK_SECRET_KEY)
  ) {
    throw new Error(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are required for Clerk authentication',
    )
  }
  if (authMode === 'authjs' && !environment.AUTH_SECRET) {
    throw new Error('Auth.js requires AUTH_SECRET')
  }
  if (authMode === 'authjs' && production && environment.AUTH_SECRET!.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters in production')
  }
  const databaseProvider = environment.DATABASE_PROVIDER ?? 'postgres'
  if (databaseProvider !== 'postgres' && databaseProvider !== 'pglite') {
    throw new Error('DATABASE_PROVIDER must be postgres or pglite')
  }
  const databaseUrl = environment.DATABASE_URL
  if (databaseProvider === 'postgres') {
    let url: URL
    try {
      url = new URL(databaseUrl ?? '')
    } catch {
      throw new Error('DATABASE_URL must be a PostgreSQL connection URL')
    }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error('DATABASE_URL must be a PostgreSQL connection URL')
    }
  }
  const fileStorageProvider = environment.FILE_STORAGE_PROVIDER ?? 'local'
  if (fileStorageProvider !== 'local' && fileStorageProvider !== 's3') {
    throw new Error('FILE_STORAGE_PROVIDER must be local or s3')
  }
  if (production && fileStorageProvider !== 's3') {
    throw new Error('S3 file storage is required in production')
  }
  const s3Bucket = environment.S3_BUCKET
  const s3Region = environment.S3_REGION
  if (fileStorageProvider === 's3' && (!s3Bucket || !s3Region)) {
    throw new Error('S3_BUCKET and S3_REGION are required for S3 file storage')
  }
  const s3Endpoint = environment.S3_ENDPOINT
  if (s3Endpoint) {
    try {
      new URL(s3Endpoint)
    } catch {
      throw new Error('S3_ENDPOINT must be a valid URL')
    }
  }
  return {
    appEnv,
    authMode,
    databaseProvider,
    databaseUrl: databaseProvider === 'postgres' ? databaseUrl : undefined,
    pgliteDataDir: environment.PGLITE_DATA_DIR || '.data/pglite',
    fileStorageProvider,
    fileStorageDir: environment.FILE_STORAGE_DIR || '.data/files',
    s3Bucket,
    s3Region,
    s3Endpoint,
  }
}
