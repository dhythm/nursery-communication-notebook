import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { detectUpload, LocalFileStorage } from './file-storage'

const directories: string[] = []
afterEach(async () =>
  Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  ),
)

describe('local file storage', () => {
  it('round trips opaque keys and rejects traversal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nursery-files-'))
    directories.push(root)
    const storage = new LocalFileStorage(root)
    await storage.put('facility/file', new Uint8Array([1, 2, 3]))
    expect(await storage.get('facility/file')).toEqual(new Uint8Array([1, 2, 3]))
    await expect(storage.put('../escape', new Uint8Array([1]))).rejects.toThrow(
      'Invalid storage key',
    )
  })
  it('detects allowed bytes instead of trusting a declared MIME type', () => {
    expect(detectUpload(new TextEncoder().encode('%PDF-1.7'), 'report.bin')).toEqual({
      contentType: 'application/pdf',
      kind: 'PDF',
    })
    expect(() => detectUpload(new TextEncoder().encode('<script>'), 'report.pdf')).toThrow(
      'UnsupportedFile',
    )
    expect(() => detectUpload(new Uint8Array([137]), 'image.png')).toThrow('UnsupportedFile')
  })
})
