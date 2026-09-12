export interface RuntimeConfig {
  appEnv: 'development' | 'test' | 'production'
  authMode: 'skip' | 'clerk'
  databaseProvider: 'postgres' | 'pglite'
  databaseUrl?: string
  pgliteDataDir: string
  fileStorageDir: string
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
  return {
    appEnv,
    authMode,
    databaseProvider,
    databaseUrl: databaseProvider === 'postgres' ? databaseUrl : undefined,
    pgliteDataDir: environment.PGLITE_DATA_DIR || '.data/pglite',
    fileStorageDir: environment.FILE_STORAGE_DIR || '.data/files',
  }
}
