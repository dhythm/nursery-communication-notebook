import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  getRuntimeConfig: vi.fn(),
  signIn: vi.fn(),
}))

vi.mock('@/lib/runtime-config', () => ({ getRuntimeConfig: fixture.getRuntimeConfig }))
vi.mock('@/auth', () => ({ signIn: fixture.signIn }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))

import { signInWithCredentials } from './actions'

describe('signInWithCredentials', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fixture.getRuntimeConfig.mockReturnValue({ authMode: 'authjs' })
  })

  it('establishes the session without a client-side redirect', async () => {
    fixture.signIn.mockResolvedValue('/')
    const formData = new FormData()
    formData.set('email', 'sakura@example.com')
    formData.set('password', 'DemoParent2026!')

    await expect(signInWithCredentials({}, formData)).resolves.toEqual({ authenticated: true })
    expect(fixture.signIn).toHaveBeenCalledWith('credentials', {
      email: 'sakura@example.com',
      password: 'DemoParent2026!',
      redirect: false,
      redirectTo: '/',
    })
  })
})
