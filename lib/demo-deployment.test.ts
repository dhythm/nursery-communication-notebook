import { describe, expect, it } from 'vitest'
import { isPublicDemoProductionDeployment } from './demo-deployment'

describe('isPublicDemoProductionDeployment', () => {
  it('only allows resets for the public demo production deployment', () => {
    expect(
      isPublicDemoProductionDeployment({
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'nursery-communication-notebook.vercel.app',
      }),
    ).toBe(true)
    expect(
      isPublicDemoProductionDeployment({
        VERCEL_ENV: 'preview',
        VERCEL_PROJECT_PRODUCTION_URL: 'nursery-communication-notebook.vercel.app',
      }),
    ).toBe(false)
    expect(
      isPublicDemoProductionDeployment({
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'another-project.vercel.app',
      }),
    ).toBe(false)
  })
})
