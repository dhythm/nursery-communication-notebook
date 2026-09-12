import { describe, expect, it } from 'vitest'
import { shouldSeedDemoData } from './demo-data-policy'

describe('demo data policy', () => {
  it('never seeds demo data in production', () => {
    expect(shouldSeedDemoData('production')).toBe(false)
    expect(shouldSeedDemoData('development')).toBe(true)
    expect(shouldSeedDemoData('test')).toBe(true)
  })
})
