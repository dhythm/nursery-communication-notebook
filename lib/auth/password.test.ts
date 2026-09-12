import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('round-trips a password without storing it as plaintext', async () => {
    const hash = await hashPassword('a secure nursery password')

    expect(hash).not.toContain('a secure nursery password')
    expect(await verifyPassword('a secure nursery password', hash)).toBe(true)
    expect(await verifyPassword('the wrong password', hash)).toBe(false)
  })

  it('rejects malformed hashes', async () => {
    expect(await verifyPassword('anything', 'not-a-password-hash')).toBe(false)
  })
})
