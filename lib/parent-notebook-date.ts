import type { CalendarEvent } from './types'
import { calendarDateParts, todayInTimeZone } from './format'

export function notebookDateOptions(today: string) {
  const { year, month, day } = calendarDateParts(today)
  const date = new Date(Date.UTC(year, month - 1, day))
  const mondayOffset = (8 - date.getUTCDay()) % 7 || 7
  const shiftedDate = (offset: number) =>
    new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10)
  return [
    { label: '今日', date: today },
    { label: '明日', date: shiftedDate(1) },
    { label: '次の月曜日', date: shiftedDate(mondayOffset) },
  ]
}

export function nextAttendanceDate(now: Date, events: CalendarEvent[], classId: string): string {
  const today = todayInTimeZone(now)
  const { year, month, day } = calendarDateParts(today)
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  )
  const date = new Date(Date.UTC(year, month - 1, day + (hour >= 12 ? 1 : 0)))
  const closureDates = events
    .filter(
      (event) =>
        event.type === '休園' &&
        (!event.status || event.status === 'published') &&
        (!event.targetClassId || event.targetClassId === classId),
    )
    .map((event) => event.date)
  while (
    date.getUTCDay() === 0 ||
    date.getUTCDay() === 6 ||
    closureDates.includes(date.toISOString().slice(0, 10))
  ) {
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return date.toISOString().slice(0, 10)
}
