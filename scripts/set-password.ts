import { stdin, stdout } from 'node:process'
import { createDatabase, migrateDatabase } from '../lib/db'
import { setUserPassword } from '../lib/auth/user-repository'
import { getRuntimeConfig } from '../lib/runtime-config'

async function readSecret(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) {
    const chunks: Buffer[] = []
    for await (const chunk of stdin) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks).toString('utf8').split(/\r?\n/)[0] ?? ''
  }
  stdout.write(prompt)
  stdin.setRawMode(true)
  stdin.resume()
  return new Promise((resolve, reject) => {
    let value = ''
    const finish = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.off('data', onData)
      stdout.write('\n')
      resolve(value)
    }
    const onData = (chunk: Buffer) => {
      const input = chunk.toString('utf8')
      if (input === '\u0003') {
        stdin.setRawMode(false)
        stdin.pause()
        reject(new Error('Cancelled'))
        return
      }
      if (input === '\r' || input === '\n') {
        finish()
        return
      }
      if (input === '\u007f') {
        value = value.slice(0, -1)
        return
      }
      value += input
    }
    stdin.on('data', onData)
  })
}

async function main() {
  const email = process.argv[2]
  if (!email) throw new Error('Usage: pnpm auth:set-password <email>')
  const config = getRuntimeConfig()
  if (config.authMode !== 'authjs') throw new Error('AUTH_MODE must be authjs')
  const password = await readSecret('New password: ')
  if (stdin.isTTY) {
    const confirmation = await readSecret('Confirm password: ')
    if (password !== confirmation) throw new Error('Passwords do not match')
  }
  const database = await createDatabase(config)
  try {
    await migrateDatabase(database)
    if (!(await setUserPassword(database, email, password))) {
      throw new Error('No application user has that email address')
    }
  } finally {
    await database.close()
  }
  stdout.write('Password updated.\n')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Password update failed'
  console.error(message)
  process.exitCode = 1
})
