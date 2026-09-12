import { describe, expect, it } from 'vitest'
import { ageFromBirthday, formatDate, formatShortDate, formatTime } from './format'

describe('date formatting', () => {
  it('formats a Japanese date with its weekday', () => {
    expect(formatDate('2026-09-12T12:00:00')).toBe('9月12日（土）')
    expect(formatDate('2026-09-13T12:00:00')).toBe('9月13日（日）')
  })

  it('formats a short date without zero padding', () => {
    expect(formatShortDate('2026-01-02T12:00:00')).toBe('1/2')
  })

  it('pads hours and minutes and omits seconds', () => {
    expect(formatTime('2026-09-12T09:05:42')).toBe('09:05')
    expect(formatTime('2026-09-12T00:00:00')).toBe('00:00')
  })
})

describe('ageFromBirthday at the demo date of September 12, 2026', () => {
  it('increments the year on the birthday', () => {
    expect(ageFromBirthday('2023-09-12')).toBe('3歳0か月')
  })

  it('keeps the previous age before the birthday', () => {
    expect(ageFromBirthday('2023-09-13')).toBe('2歳11か月')
  })

  it('counts completed months across a year boundary', () => {
    expect(ageFromBirthday('2023-12-13')).toBe('2歳8か月')
  })
})
