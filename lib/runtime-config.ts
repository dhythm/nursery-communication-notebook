export interface RuntimeConfig {
  appEnv: 'development' | 'test' | 'production'
  authMode: 'skip' | 'clerk'
  databaseProvider: 'postgres' | 'pglite'
  databaseUrl?: string
  pgliteDataDir: string
  fileStorageProvider: 'local' | 's3'
  fileStorageDir: string
  s3Bucket?: string
  s3Region?: string
  s3Endpoint?: string
}

/** Server configuration. No credentials or environment values are sent to the browser. */
export function getRuntimeConfig(
  environment: Record<string, string | undefined> = process.env,
): RuntimeConfig {
  const appEnv = environment.APP_ENV ?? 'production'
  if (appEnv !== 'development' && appEnv !== 'test' && appEnv !== 'production') {
    throw new Error('APP_ENV must be development, test, or production')
  }
  const authMode = environment.AUTH_MODE
  if (authMode !== 'skip' && authMode !== 'clerk') {
    throw new Error('AUTH_MODE must be skip or clerk')
  }
  const production = appEnv === 'production' || environment.VERCEL_ENV === 'production'
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
