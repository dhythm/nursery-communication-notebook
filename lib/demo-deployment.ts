const publicDemoHost = 'nursery-communication-notebook.vercel.app'

export function isPublicDemoProductionDeployment(environment: Record<string, string | undefined>) {
  const productionHost =
    environment.VERCEL_PROJECT_PRODUCTION_URL ??
    environment.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
  return environment.VERCEL_ENV === 'production' && productionHost === publicDemoHost
}
