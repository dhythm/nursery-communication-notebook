import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from './types'
import { nextAttendanceDate, notebookDateOptions } from './parent-notebook-date'

describe('notebook target dates', () => {
  it.each([
    ['2026-09-12', '2026-09-13', '2026-09-14'],
    ['2026-09-13', '2026-09-14', '2026-09-14'],
    ['2026-09-14', '2026-09-15', '2026-09-21'],
    ['2026-12-31', '2027-01-01', '2027-01-04'],
  ])('offers today, tomorrow and the next Monday from %s', (today, tomorrow, monday) => {
    expect(notebookDateOptions(today)).toEqual([
      { label: '今日', date: today },
      { label: '明日', date: tomorrow },
      { label: '次の月曜日', date: monday },
    ])
  })
})

describe('next attendance date for home', () => {
  it.each([
    ['2026-09-14T07:00:00+09:00', '2026-09-14'],
    ['2026-09-14T11:59:59+09:00', '2026-09-14'],
    ['2026-09-14T12:00:00+09:00', '2026-09-15'],
    ['2026-09-14T21:00:00+09:00', '2026-09-15'],
    ['2026-09-11T21:00:00+09:00', '2026-09-14'],
    ['2026-09-12T07:00:00+09:00', '2026-09-14'],
    ['2026-09-13T21:00:00+09:00', '2026-09-14'],
  ])('selects the next attendance date at %s', (instant, expected) => {
    expect(nextAttendanceDate(new Date(instant), [], 'class-1')).toBe(expected)
  })

  it('skips published nursery and selected-class closures only', () => {
    const events: CalendarEvent[] = [
      {
        id: '1',
        facilityId: 'f1',
        date: '2026-09-14',
        title: '休園',
        type: '休園',
        status: 'published',
      },
      {
        id: '2',
        facilityId: 'f1',
        date: '2026-09-15',
        title: 'クラス休園',
        type: '休園',
        targetClassId: 'class-1',
      },
      {
        id: '3',
        facilityId: 'f1',
        date: '2026-09-16',
        title: '別クラス',
        type: '休園',
        targetClassId: 'class-2',
      },
      {
        id: '4',
        facilityId: 'f1',
        date: '2026-09-16',
        title: '中止',
        type: '休園',
        status: 'cancelled',
      },
      {
        id: '5',
        facilityId: 'f1',
        date: '2026-09-16',
        title: '下書き',
        type: '休園',
        status: 'draft',
      },
      {
        id: '6',
        facilityId: 'f1',
        date: '2026-09-16',
        title: '行事',
        type: '行事',
        status: 'published',
      },
    ]
    expect(nextAttendanceDate(new Date('2026-09-12T10:00:00+09:00'), events, 'class-1')).toBe(
      '2026-09-16',
    )
  })
})
