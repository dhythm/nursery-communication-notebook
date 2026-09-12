import { beforeEach, describe, expect, it, vi } from 'vitest'
import { users } from '@/lib/mock-data'
import { handleOperationsGet, handleOperationsPost } from './operations'
const mock = vi.hoisted(() => ({
  current: vi.fn(),
  facility: vi.fn(),
  read: vi.fn(),
  mutate: vi.fn(),
}))
vi.mock('@/lib/auth/server', () => ({
  getCurrentUser: mock.current,
  getFacilityUser: mock.facility,
}))
vi.mock('@/lib/db', () => ({ getDatabase: async () => ({}) }))
vi.mock('@/lib/operations/service', async () => {
  const { z } = await import('zod')
  return {
    operationModuleSchema: z.enum(['risks', 'attendance', 'plans', 'nap']),
    readOperations: mock.read,
    mutateOperations: mock.mutate,
  }
})
const teacher = users.find((user) => user.role === 'teacher')!
const url = 'http://localhost/api/nurseries/nijiiro/operations?module=nap'
const post = (
  body = '{}',
  headers: Record<string, string> = { 'content-type': 'application/json' },
) => new Request(url, { method: 'POST', headers, body })
beforeEach(() => {
  vi.clearAllMocks()
  mock.current.mockResolvedValue(teacher)
  mock.facility.mockResolvedValue(teacher)
  mock.read.mockResolvedValue({ sessions: [] })
})
describe('operations HTTP boundary', () => {
  it('rejects anonymous access', async () => {
    mock.current.mockResolvedValue(null)
    expect((await handleOperationsGet(new Request(url), 'nijiiro')).status).toBe(401)
  })
  it('hides facilities outside membership', async () => {
    mock.facility.mockResolvedValue(null)
    expect((await handleOperationsGet(new Request(url), 'other')).status).toBe(404)
  })
  it('forbids parent access', async () => {
    mock.facility.mockResolvedValue(users[0])
    expect((await handleOperationsPost(post(), 'nijiiro')).status).toBe(403)
    expect(mock.mutate).not.toHaveBeenCalled()
  })
  it('rejects cross-origin writes', async () => {
    expect(
      (
        await handleOperationsPost(
          post('{}', { 'content-type': 'application/json', origin: 'https://other.example' }),
          'nijiiro',
        )
      ).status,
    ).toBe(403)
  })
  it('requires JSON', async () => {
    expect((await handleOperationsPost(post('{}', {}), 'nijiiro')).status).toBe(415)
  })
  it('rejects malformed input', async () => {
    expect((await handleOperationsPost(post('{'), 'nijiiro')).status).toBe(400)
  })
  it('rejects large input', async () => {
    expect((await handleOperationsPost(post('x'.repeat(100001)), 'nijiiro')).status).toBe(413)
  })
  it('validates module selection', async () => {
    expect(
      (await handleOperationsGet(new Request(url.replace('nap', 'unknown')), 'nijiiro')).status,
    ).toBe(400)
  })
  it('returns conflicts for stale records', async () => {
    mock.mutate.mockRejectedValueOnce(new Error('Conflict'))
    expect((await handleOperationsPost(post(), 'nijiiro')).status).toBe(409)
  })
  it('does not cache private operational records', async () => {
    const response = await handleOperationsGet(new Request(url), 'nijiiro')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ sessions: [] })
  })
})
