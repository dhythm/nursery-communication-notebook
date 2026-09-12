export function logError(event: string, error: unknown, context: Record<string, unknown> = {}) {
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: 'Unknown error' }
  console.error(
    JSON.stringify({
      level: 'error',
      event,
      ...context,
      error: detail,
      timestamp: new Date().toISOString(),
    }),
  )
}
