import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('combines conditional classes while omitting false values', () => {
    expect(cn('rounded-xl', undefined, false, { 'font-bold': true, hidden: false })).toBe(
      'rounded-xl font-bold',
    )
  })

  it('lets a later Tailwind class override a conflicting default', () => {
    expect(cn('p-2 text-sm', 'p-4')).toBe('text-sm p-4')
  })

  it('preserves styles for distinct responsive variants', () => {
    expect(cn('p-2 md:p-4', 'p-3')).toBe('md:p-4 p-3')
  })
})
