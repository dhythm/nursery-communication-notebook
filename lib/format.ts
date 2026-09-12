import type { EventType, Mood } from './types'

const weekdays = ['日', '月', '火', '水', '木', '金', '土']
const APP_TIME_ZONE = 'Asia/Tokyo'

export function todayInTimeZone(now = new Date(), timeZone = APP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function calendarDateParts(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) throw new Error(`Invalid calendar date: ${iso}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

export function formatDate(iso: string): string {
  const { year, month, day } = calendarDateParts(iso)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${month}月${day}日（${weekdays[weekday]}）`
}

export function formatShortDate(iso: string): string {
  const { month, day } = calendarDateParts(iso)
  return `${month}/${day}`
}

export function formatTime(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(iso)) return iso.slice(11, 16)
  const d = new Date(iso)
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d)
}

export function ageFromBirthday(iso: string, asOf = todayInTimeZone()): string {
  const birthday = calendarDateParts(iso)
  const current = calendarDateParts(asOf)
  let years = current.year - birthday.year
  let months = current.month - birthday.month
  if (current.day < birthday.day) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }
  return `${years}歳${months}か月`
}

export const moodConfig: Record<Mood, { label: string; emoji: string; color: string }> = {
  good: { label: 'よい', emoji: '◎', color: 'oklch(0.67 0.13 158)' },
  normal: { label: 'ふつう', emoji: '○', color: 'oklch(0.78 0.13 75)' },
  bad: { label: 'わるい', emoji: '△', color: 'oklch(0.62 0.19 25)' },
}

export const eventColor: Record<EventType, string> = {
  行事: 'oklch(0.67 0.13 158)',
  面談: 'oklch(0.65 0.11 240)',
  健診: 'oklch(0.78 0.13 75)',
  休園: 'oklch(0.62 0.19 25)',
  持ち物: 'oklch(0.7 0.13 330)',
}
