import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { loadEnvConfig } from '@next/env'
import { createDatabase } from '../lib/db'
import { getRuntimeConfig } from '../lib/runtime-config'

async function run(program: string, args: string[]) {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(program, args, { stdio: 'inherit', env: process.env })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${program} failed`)),
    )
  })
}

async function isEmpty(path: string) {
  try {
    return (await readdir(path)).length === 0
  } catch {
    return true
  }
}

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')
  const [command, pathArgument] = process.argv.slice(2)
  const config = getRuntimeConfig()
  if (command === 'backup') {
    if (!pathArgument) throw new Error('Backup path is required')
    const target = resolve(pathArgument)
    await mkdir(dirname(target), { recursive: true })
    if (config.databaseProvider === 'postgres')
      await run('pg_dump', ['--format=custom', `--file=${target}`, config.databaseUrl!])
    else
      await cp(resolve(config.pgliteDataDir), target, {
        recursive: true,
        force: false,
        errorOnExist: true,
      })
    await cp(resolve(config.fileStorageDir), `${target}.files`, {
      recursive: true,
      force: false,
      errorOnExist: true,
    }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    })
    return
  }
  if (command === 'restore') {
    if (process.env.RESTORE_CONFIRM !== 'YES' || !pathArgument)
      throw new Error('Set RESTORE_CONFIRM=YES and provide a backup path')
    const source = resolve(pathArgument)
    await stat(source)
    if (config.databaseProvider === 'postgres') {
      const database = await createDatabase(config)
      const count = await database.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM information_schema.tables WHERE table_schema = 'public'`,
      )
      await database.close()
      if (count.rows[0].count !== 0) throw new Error('Restore target database must be empty')
      await run('pg_restore', ['--exit-on-error', `--dbname=${config.databaseUrl!}`, source])
    } else {
      const target = resolve(config.pgliteDataDir)
      if (!(await isEmpty(target))) throw new Error('Restore target directory must be empty')
      await cp(source, target, { recursive: true, force: false, errorOnExist: true })
    }
    const fileTarget = resolve(config.fileStorageDir)
    if (!(await isEmpty(fileTarget))) throw new Error('Restore file directory must be empty')
    await cp(`${source}.files`, fileTarget, {
      recursive: true,
      force: false,
      errorOnExist: true,
    }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    })
    return
  }
  if (command === 'retention') {
    const days = Number(process.env.RETENTION_DAYS ?? 2555)
    if (!Number.isInteger(days) || days < 365)
      throw new Error('RETENTION_DAYS must be at least 365')
    const database = await createDatabase(config)
    try {
      const candidates = await database.query<{ entity: string; count: number }>(
        `SELECT 'notebook_entry' AS entity, count(*)::integer AS count FROM notebook_entry WHERE status = 'withdrawn' AND updated_at < now() - ($1 || ' days')::interval
         UNION ALL SELECT 'notice', count(*)::integer FROM notice WHERE status = 'withdrawn' AND updated_at < now() - ($1 || ' days')::interval
         UNION ALL SELECT 'calendar_event', count(*)::integer FROM calendar_event WHERE status = 'cancelled' AND updated_at < now() - ($1 || ' days')::interval`,
        [String(days)],
      )
      console.log(
        JSON.stringify({
          apply: process.env.RETENTION_APPLY === 'YES',
          days,
          candidates: candidates.rows,
        }),
      )
      if (process.env.RETENTION_APPLY === 'YES')
        await database.transaction(async (transaction) => {
          await transaction.query(
            `DELETE FROM notebook_entry WHERE status = 'withdrawn' AND updated_at < now() - ($1 || ' days')::interval`,
            [String(days)],
          )
          await transaction.query(
            `DELETE FROM notice WHERE status = 'withdrawn' AND updated_at < now() - ($1 || ' days')::interval`,
            [String(days)],
          )
          await transaction.query(
            `DELETE FROM calendar_event WHERE status = 'cancelled' AND updated_at < now() - ($1 || ' days')::interval`,
            [String(days)],
          )
        })
    } finally {
      await database.close()
    }
    return
  }
  throw new Error('Usage: data-maintenance.ts <backup|restore|retention> [path]')
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Maintenance failed')
  process.exitCode = 1
})
