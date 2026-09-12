import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getFacilityUser: vi.fn(),
  deleteSharedFile: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  getCurrentUser: mocks.getCurrentUser,
  getFacilityUser: mocks.getFacilityUser,
}))
vi.mock('@/lib/db', () => ({ getDatabase: async () => ({}) }))
vi.mock('@/lib/file-storage', () => ({ createFileStorage: () => ({}) }))
vi.mock('@/lib/runtime-config', () => ({ getRuntimeConfig: () => ({}) }))
vi.mock('@/lib/file-repository', () => ({
  uploadSharedFile: vi.fn(),
  getSharedFile: vi.fn(),
  deleteSharedFile: mocks.deleteSharedFile,
}))

import { handleFileDelete, handleFileDownload, handleFileUpload } from './file'

describe('facility file API authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user', role: 'teacher' })
    mocks.getFacilityUser.mockResolvedValue(null)
  })

  it('hides uploads and downloads for a slug outside the membership', async () => {
    const upload = await handleFileUpload(
      new Request('http://localhost/api/nurseries/himawari/files', { method: 'POST' }),
      'himawari',
    )
    const download = await handleFileDownload(
      new Request('http://localhost/api/nurseries/himawari/files/file-1'),
      'himawari',
      'file-1',
    )
    expect(upload.status).toBe(404)
    expect(download.status).toBe(404)
  })

  it('hides deletion for a slug outside the membership', async () => {
    const response = await handleFileDelete(
      new Request('http://localhost/api/nurseries/himawari/files/file-1', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ commandId: 'delete-file-1' }),
      }),
      'himawari',
      'file-1',
    )
    expect(response.status).toBe(404)
    expect(mocks.deleteSharedFile).not.toHaveBeenCalled()
  })

  it('deletes through the facility-scoped repository operation', async () => {
    const teacher = { id: 'teacher', role: 'teacher', facilityId: 'f1' }
    mocks.getFacilityUser.mockResolvedValue(teacher)
    const response = await handleFileDelete(
      new Request('http://localhost/api/nurseries/nijiiro/files/file-1', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({ commandId: 'delete-file-1' }),
      }),
      'nijiiro',
      'file-1',
    )
    expect(response.status).toBe(200)
    expect(mocks.deleteSharedFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      teacher,
      'file-1',
      'delete-file-1',
    )
  })

  it('rejects cross-origin deletion', async () => {
    mocks.getFacilityUser.mockResolvedValue({ id: 'teacher', role: 'teacher', facilityId: 'f1' })
    const response = await handleFileDelete(
      new Request('http://localhost/api/nurseries/nijiiro/files/file-1', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', origin: 'https://example.com' },
        body: JSON.stringify({ commandId: 'delete-file-1' }),
      }),
      'nijiiro',
      'file-1',
    )
    expect(response.status).toBe(403)
    expect(mocks.deleteSharedFile).not.toHaveBeenCalled()
  })
})
