import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth/server', () => ({
  getCurrentUser: async () => ({ id: 'parent', role: 'parent' }),
  getFacilityUser: async (slug: string) =>
    slug === 'nijiiro' ? { id: 'parent', role: 'parent', facilityId: 'f1' } : null,
}))
vi.mock('@/lib/db', () => ({ getDatabase: async () => ({}) }))
vi.mock('@/lib/repository', () => ({ mutateNotebook: vi.fn(), readNotebook: vi.fn() }))
import { mutateNotebook } from '@/lib/repository'
import { handleNotebookPost } from '@/lib/api/notebook'

describe('notebook request origin', () => {
  beforeEach(() => vi.clearAllMocks())
  it('accepts the browser Host when Next normalizes the internal request URL', async () => {
    const response = await handleNotebookPost(
      new Request('http://localhost:3100/api/nurseries/nijiiro/notebook', {
        method: 'POST',
        headers: {
          host: '127.0.0.1:3100',
          origin: 'http://127.0.0.1:3100',
          'content-type': 'application/json',
        },
        body: '{}',
      }),
      'nijiiro',
    )
    expect(response.status).toBe(200)
  })
  it('rejects requests from another origin', async () => {
    const response = await handleNotebookPost(
      new Request('http://localhost:3100/api/nurseries/nijiiro/notebook', {
        method: 'POST',
        headers: {
          host: '127.0.0.1:3100',
          origin: 'http://evil.example',
          'content-type': 'application/json',
        },
        body: '{}',
      }),
      'nijiiro',
    )
    expect(response.status).toBe(403)
  })
  it('returns a conflict when a stale version is updated', async () => {
    vi.mocked(mutateNotebook).mockRejectedValueOnce(new Error('Conflict'))
    const response = await handleNotebookPost(
      new Request('http://localhost:3100/api/nurseries/nijiiro/notebook', {
        method: 'POST',
        headers: { host: 'localhost:3100', 'content-type': 'application/json' },
        body: '{}',
      }),
      'nijiiro',
    )
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: '他の利用者が先に更新しました。再読み込みして確認してください。',
    })
  })
  it('hides another facility behind a not-found response', async () => {
    const response = await handleNotebookPost(
      new Request('http://localhost:3100/api/nurseries/himawari/notebook', {
        method: 'POST',
        headers: { host: 'localhost:3100', 'content-type': 'application/json' },
        body: '{}',
      }),
      'himawari',
    )
    expect(response.status).toBe(404)
    expect(mutateNotebook).not.toHaveBeenCalled()
  })
})
