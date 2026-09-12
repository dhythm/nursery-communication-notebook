import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { RuntimeConfig } from './runtime-config'

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

type ObjectStorageCommand = PutObjectCommand | GetObjectCommand | DeleteObjectCommand
type SendObjectStorageCommand = (command: ObjectStorageCommand) => Promise<unknown>

export class S3FileStorage implements FileStorage {
  private readonly sendCommand: SendObjectStorageCommand

  constructor(
    private readonly config: { bucket: string; region: string; endpoint?: string },
    sendCommand?: SendObjectStorageCommand,
  ) {
    if (sendCommand) {
      this.sendCommand = sendCommand
      return
    }
    const client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: Boolean(config.endpoint),
    })
    this.sendCommand = (command) => client.send(command)
  }

  async put(key: string, bytes: Uint8Array) {
    assertKey(key)
    await this.sendCommand(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: bytes,
        ServerSideEncryption: 'AES256',
      }),
    )
  }

  async get(key: string) {
    assertKey(key)
    const response = (await this.sendCommand(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    )) as { Body?: { transformToByteArray(): Promise<Uint8Array | undefined> } }
    const bytes = await response.Body?.transformToByteArray()
    if (!bytes) throw new Error('FileNotFound')
    return new Uint8Array(bytes)
  }

  async delete(key: string) {
    assertKey(key)
    await this.sendCommand(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }))
  }
}

type FileStorageConfig = Pick<
  RuntimeConfig,
  'fileStorageProvider' | 'fileStorageDir' | 's3Bucket' | 's3Region' | 's3Endpoint'
>

export function createFileStorage(config: FileStorageConfig): FileStorage {
  if (config.fileStorageProvider === 'local') return new LocalFileStorage(config.fileStorageDir)
  if (!config.s3Bucket || !config.s3Region) throw new Error('S3 storage is not configured')
  return new S3FileStorage({
    bucket: config.s3Bucket,
    region: config.s3Region,
    endpoint: config.s3Endpoint,
  })
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
