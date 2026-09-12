import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth/server', () => ({
  getCurrentUser: async () => ({ id: 'parent', role: 'parent' }),
}))
vi.mock('@/lib/db', () => ({ getDatabase: async () => ({}) }))
vi.mock('@/lib/repository', () => ({ mutateNotebook: vi.fn(), readNotebook: vi.fn() }))
import { POST } from './route'

describe('notebook request origin', () => {
  it('accepts the browser Host when Next normalizes the internal request URL', async () => {
    const response = await POST(
      new Request('http://localhost:3100/api/notebook', {
        method: 'POST',
        headers: {
          host: '127.0.0.1:3100',
          origin: 'http://127.0.0.1:3100',
          'content-type': 'application/json',
        },
        body: '{}',
      }),
    )
    expect(response.status).toBe(200)
  })
  it('rejects requests from another origin', async () => {
    const response = await POST(
      new Request('http://localhost:3100/api/notebook', {
        method: 'POST',
        headers: {
          host: '127.0.0.1:3100',
          origin: 'http://evil.example',
          'content-type': 'application/json',
        },
        body: '{}',
      }),
    )
    expect(response.status).toBe(403)
  })
})
