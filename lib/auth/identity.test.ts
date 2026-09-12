import { describe, expect, it } from 'vitest'
import { getSkipRole } from './identity'

describe('development role mapping', () => {
  it('defaults missing or forged skip roles to parent', () => {
    expect(getSkipRole(undefined)).toBe('parent')
    expect(getSkipRole('admin')).toBe('parent')
    expect(getSkipRole('teacher')).toBe('teacher')
  })
})
