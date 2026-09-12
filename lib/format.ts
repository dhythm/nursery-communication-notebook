import type { EventType, Mood } from './types'

const weekdays = ['日', '月', '火', '水', '木', '金', '土']

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`
}

export function ageFromBirthday(iso: string): string {
  const b = new Date(iso)
  const now = new Date('2026-09-12')
  let years = now.getFullYear() - b.getFullYear()
  let months = now.getMonth() - b.getMonth()
  if (now.getDate() < b.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }
  return `${years}歳${months}か月`
}

export const moodConfig: Record<Mood, { label: string; emoji: string; color: string }> = {
  genki: { label: 'げんき', emoji: '◎', color: 'oklch(0.67 0.13 158)' },
  normal: { label: 'ふつう', emoji: '○', color: 'oklch(0.78 0.13 75)' },
  tired: { label: 'つかれ気味', emoji: '△', color: 'oklch(0.7 0.13 40)' },
  sick: { label: '体調不良', emoji: '×', color: 'oklch(0.62 0.19 25)' },
}

export const eventColor: Record<EventType, string> = {
  行事: 'oklch(0.67 0.13 158)',
  面談: 'oklch(0.65 0.11 240)',
  健診: 'oklch(0.78 0.13 75)',
  休園: 'oklch(0.62 0.19 25)',
  持ち物: 'oklch(0.7 0.13 330)',
}
