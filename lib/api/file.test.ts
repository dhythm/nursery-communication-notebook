import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/server', () => ({
  getCurrentUser: async () => ({ id: 'parent', role: 'parent' }),
  getFacilityUser: async () => null,
}))

import { handleFileDownload, handleFileUpload } from './file'

describe('facility file API authorization', () => {
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
})
