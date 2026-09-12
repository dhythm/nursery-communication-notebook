import { randomUUID } from 'node:crypto'
import type { Database } from './db'
import type { FileStorage } from './file-storage'
import { detectUpload } from './file-storage'
import type { User } from './types'

export async function uploadSharedFile(
  database: Database,
  storage: FileStorage,
  user: User,
  input: {
    fileName: string
    displayName: string
    bytes: Uint8Array
    commandId: string
    targetClassId?: string
    targetChildId?: string
    purpose?: 'shared' | 'notebook'
  },
  now = new Date(),
) {
  const purpose = input.purpose ?? 'shared'
  if (purpose === 'shared' && user.role !== 'teacher') throw new Error('Forbidden')
  if (!input.commandId || input.commandId.length > 100) throw new Error('InvalidCommand')
  const name = input.displayName.trim()
  if (
    !name ||
    name.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(name) ||
    input.fileName.length > 255 ||
    /[\u0000-\u001f\u007f]/.test(input.fileName)
  )
    throw new Error('InvalidFileName')
  const detected = detectUpload(input.bytes, input.fileName)
  if (purpose === 'notebook' && detected.kind !== '画像') throw new Error('UnsupportedFile')
  if (purpose === 'notebook' && !input.targetChildId) throw new Error('Forbidden')
  if (input.targetClassId) {
    const target = await database.query(
      `SELECT class.id FROM nursery_class class
       WHERE class.id = $1 AND class.facility_id = $2 AND (
         EXISTS (SELECT 1 FROM facility_membership membership
           WHERE membership.facility_id = class.facility_id AND membership.user_id = $3
             AND membership.role = 'teacher' AND membership.ended_on IS NULL)
         OR EXISTS (SELECT 1 FROM guardian_child guardian
           JOIN child_enrollment enrollment ON enrollment.child_id = guardian.child_id
           WHERE guardian.facility_id = class.facility_id AND guardian.guardian_user_id = $3
             AND guardian.ended_on IS NULL AND enrollment.ended_on IS NULL
             AND enrollment.class_id = class.id)
       )`,
      [input.targetClassId, user.facilityId, user.id],
    )
    if (target.rows.length === 0) throw new Error('Forbidden')
  }
  if (input.targetChildId) {
    const target = await database.query(
      `SELECT child.id FROM child WHERE child.id = $1 AND child.facility_id = $2 AND (
         EXISTS (SELECT 1 FROM facility_membership membership WHERE membership.facility_id = child.facility_id
           AND membership.user_id = $3 AND membership.role = 'teacher' AND membership.ended_on IS NULL)
         OR EXISTS (SELECT 1 FROM guardian_child guardian WHERE guardian.child_id = child.id
           AND guardian.guardian_user_id = $3 AND guardian.ended_on IS NULL))`,
      [input.targetChildId, user.facilityId, user.id],
    )
    if (target.rows.length === 0) throw new Error('Forbidden')
  }
  const previous = await database.query<{ id: string; storage_key: string; status: string }>(
    `SELECT id, storage_key, status FROM file_object
     WHERE uploader_user_id = $1 AND command_id = $2`,
    [user.id, input.commandId],
  )
  if (previous.rows[0]?.status === 'available') return previous.rows[0].id
  const fileId = previous.rows[0]?.id ?? randomUUID()
  const storageKey = previous.rows[0]?.storage_key ?? `${user.facilityId}/${fileId}`
  if (!previous.rows[0]) {
    await database.query(
      `INSERT INTO file_object
       (id, facility_id, storage_key, original_name, display_name, content_type, byte_size,
        kind, purpose, uploader_user_id, audience_type, target_class_id, target_child_id, command_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
               CASE WHEN $12::text IS NOT NULL THEN 'child' WHEN $11::text IS NOT NULL THEN 'class' ELSE 'all' END,
               CASE WHEN $12::text IS NULL THEN $11 ELSE NULL END, $12, $13, 'uploading', $14, $14)`,
      [
        fileId,
        user.facilityId,
        storageKey,
        input.fileName,
        name,
        detected.contentType,
        input.bytes.length,
        detected.kind,
        purpose,
        user.id,
        input.targetClassId ?? null,
        input.targetChildId ?? null,
        input.commandId,
        now.toISOString(),
      ],
    )
  }
  try {
    await storage.put(storageKey, input.bytes)
    await database.transaction(async (transaction) => {
      await transaction.query(
        `UPDATE file_object SET status = 'available', updated_at = $2 WHERE id = $1`,
        [fileId, now.toISOString()],
      )
      await transaction.query(
        `INSERT INTO audit_log
         (id, facility_id, actor_user_id, actor_role, action, entity_type, entity_id, command_id, after_data, occurred_at)
         VALUES ($1, $2, $3, $4, 'uploaded', 'file', $5, $6, $7::jsonb, $8)
         ON CONFLICT DO NOTHING`,
        [
          randomUUID(),
          user.facilityId,
          user.id,
          user.role,
          fileId,
          input.commandId,
          JSON.stringify({
            displayName: name,
            byteSize: input.bytes.length,
            targetClassId: input.targetClassId,
          }),
          now.toISOString(),
        ],
      )
    })
    return fileId
  } catch (error) {
    await database.query(
      `UPDATE file_object SET status = 'failed', updated_at = $2 WHERE id = $1`,
      [fileId, now.toISOString()],
    )
    await storage.delete(storageKey).catch(() => undefined)
    throw error
  }
}

export async function getSharedFile(database: Database, user: User, fileId: string) {
  const result = await database.query<{
    storage_key: string
    original_name: string
    content_type: string
    byte_size: number
  }>(
    `SELECT file.storage_key, file.original_name, file.content_type, file.byte_size
     FROM file_object file
     WHERE file.id = $1 AND file.facility_id = $2 AND file.status = 'available'
       AND EXISTS (SELECT 1 FROM facility_membership membership
         WHERE membership.facility_id = file.facility_id AND membership.user_id = $3
           AND membership.role = $4 AND membership.ended_on IS NULL)
       AND ($4 = 'teacher' OR file.audience_type = 'all' OR (file.audience_type = 'class' AND EXISTS (
         SELECT 1 FROM guardian_child guardian
         JOIN child_enrollment enrollment ON enrollment.child_id = guardian.child_id
         WHERE guardian.guardian_user_id = $3 AND guardian.ended_on IS NULL
           AND enrollment.ended_on IS NULL AND enrollment.class_id = file.target_class_id
       )) OR (file.audience_type = 'child' AND EXISTS (
         SELECT 1 FROM guardian_child guardian WHERE guardian.guardian_user_id = $3
           AND guardian.child_id = file.target_child_id AND guardian.ended_on IS NULL
       )))`,
    [fileId, user.facilityId, user.id, user.role],
  )
  return result.rows[0]
}
