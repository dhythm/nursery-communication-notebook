import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

export interface FileStorage {
  put(key: string, bytes: Uint8Array): Promise<void>
  get(key: string): Promise<Uint8Array>
  delete(key: string): Promise<void>
}

function assertKey(key: string) {
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(key)) throw new Error('Invalid storage key')
}

export class LocalFileStorage implements FileStorage {
  readonly root: string
  constructor(root: string) {
    this.root = resolve(root)
  }
  private path(key: string) {
    assertKey(key)
    const path = resolve(join(this.root, key))
    if (!path.startsWith(`${this.root}${sep}`)) throw new Error('Invalid storage key')
    return path
  }
  async put(key: string, bytes: Uint8Array) {
    const path = this.path(key)
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${crypto.randomUUID()}.tmp`
    await writeFile(temporary, bytes)
    await rename(temporary, path)
  }
  async get(key: string) {
    return new Uint8Array(await readFile(this.path(key)))
  }
  async delete(key: string) {
    await rm(this.path(key), { force: true })
  }
}

export function detectUpload(bytes: Uint8Array, name: string) {
  const lower = name.toLowerCase()
  if (bytes.length === 0) throw new Error('EmptyFile')
  if (bytes.length > 10 * 1024 * 1024) throw new Error('FileTooLarge')
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  )
    return { contentType: 'application/pdf', kind: 'PDF' as const }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { contentType: 'image/jpeg', kind: '画像' as const }
  if (
    bytes.length >= 8 &&
    bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])
  )
    return { contentType: 'image/png', kind: '画像' as const }
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  )
    return { contentType: 'image/webp', kind: '画像' as const }
  const archiveNames = lower.endsWith('.docx') ? new TextDecoder().decode(bytes) : ''
  if (
    bytes.length >= 4 &&
    lower.endsWith('.docx') &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    archiveNames.includes('[Content_Types].xml') &&
    archiveNames.includes('word/')
  )
    return {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      kind: '文書' as const,
    }
  throw new Error('UnsupportedFile')
}
