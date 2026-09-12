import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  getRuntimeConfig: vi.fn(),
  getCookie: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/runtime-config', () => ({ getRuntimeConfig: fixture.getRuntimeConfig }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: fixture.getCookie,
    set: fixture.setCookie,
    delete: fixture.deleteCookie,
  }),
}))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
}))
import { getCurrentUser, getIdentity, requireRole } from './server'
import { selectSkipRole, clearSkipRole } from './actions'

describe('server authentication boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fixture.getRuntimeConfig.mockReturnValue({ authMode: 'skip' })
    fixture.setCookie.mockImplementation((_name, value) =>
      fixture.getCookie.mockReturnValue({ value }),
    )
    fixture.deleteCookie.mockImplementation(() => fixture.getCookie.mockReturnValue(undefined))
  })

  it('allows development without an authentication session', async () => {
    expect(await getIdentity()).toEqual({ id: 'u1', role: 'parent' })
  })

  it('uses the selected development role', async () => {
    fixture.getCookie.mockReturnValue({ value: 'teacher' })
    expect((await getCurrentUser())?.role).toBe('teacher')
  })

  it('rejects role changes if development authentication is disabled', async () => {
    fixture.getRuntimeConfig.mockImplementation(() => {
      throw new Error('Development authentication is disabled')
    })
    await expect(selectSkipRole('teacher')).rejects.toThrow('disabled')
    expect(fixture.setCookie).not.toHaveBeenCalled()
  })

  it('rejects identity reads when the environment is invalid', async () => {
    fixture.getRuntimeConfig.mockImplementation(() => {
      throw new Error('Invalid environment')
    })
    await expect(getIdentity()).rejects.toThrow('Invalid environment')
    expect(fixture.getCookie).not.toHaveBeenCalled()
  })

  it('rejects server-rendered teacher routes for parents', async () => {
    await expect(requireRole('teacher')).rejects.toThrow('redirect:/nurseries/nijiiro/parent')
  })

  it('returns the server identity after role changes and logout', async () => {
    expect((await selectSkipRole('teacher'))?.role).toBe('teacher')
    expect((await clearSkipRole())?.role).toBe('parent')
    expect(await getIdentity()).toEqual({ id: 'u1', role: 'parent' })
  })

  it('persists role selection in an HttpOnly development cookie', async () => {
    await selectSkipRole('teacher')
    expect(fixture.setCookie).toHaveBeenCalledWith('nursery-development-role', 'teacher', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  })
})
