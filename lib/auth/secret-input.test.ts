import { describe, expect, it } from 'vitest'
import { consumeSecretInput } from './secret-input'

describe('consumeSecretInput', () => {
  it('finishes a pasted password at the first newline without storing it', () => {
    expect(consumeSecretInput('', 'pasted-password\n')).toEqual({
      value: 'pasted-password',
      completed: true,
      cancelled: false,
    })
  })

  it('applies backspace before completing the input', () => {
    expect(consumeSecretInput('secret-x', '\u007f\r')).toEqual({
      value: 'secret-',
      completed: true,
      cancelled: false,
    })
  })

  it('reports cancellation without appending control characters', () => {
    expect(consumeSecretInput('secret', '\u0003')).toEqual({
      value: 'secret',
      completed: false,
      cancelled: true,
    })
  })
})
