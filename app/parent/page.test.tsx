import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotebookEntry } from '@/lib/types'
import ParentHome from './page'

const state = vi.hoisted(() => ({ notebookEntries: [] as NotebookEntry[] }))

vi.mock('@/lib/store', () => ({
  useStore: () => ({
    currentUser: { id: 'parent-1', name: '田中 保護者' },
    notebookEntries: state.notebookEntries,
    notices: [],
    calendarEvents: [],
    notifications: [],
  }),
}))
vi.mock('@/lib/parent-context', () => ({
  useParent: () => ({
    selectedChild: {
      id: 'child-1',
      name: '田中 ひなた',
      birthday: '2021-07-01',
      className: 'そら組',
      avatarColor: '#ffa499',
    },
  }),
}))
vi.mock('@/lib/facility-path-client', () => ({ useFacilityPath: () => (path: string) => path }))
vi.mock('@/components/parent/entry-dialog', () => ({ EntryDialog: () => null }))
vi.mock('@/components/notebook-entry-card', () => ({
  NotebookEntryCard: ({ entry }: { entry: NotebookEntry }) => <article>{entry.note}</article>,
}))

function entry(overrides: Partial<NotebookEntry> = {}): NotebookEntry {
  return {
    id: 'yesterday',
    childId: 'child-1',
    date: '2026-09-12',
    author: 'teacher',
    authorName: '先生',
    mood: 'good',
    temperature: '36.5',
    meals: '',
    nap: '',
    toilet: '',
    note: '昨日の記録',
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T15:30:00Z'))
  state.notebookEntries = []
})
afterEach(() => vi.useRealTimers())

describe('parent home today notebook', () => {
  it('shows an empty state instead of yesterday’s entry after midnight in Japan', () => {
    state.notebookEntries = [entry()]
    const html = renderToStaticMarkup(<ParentHome />)
    expect(html).toContain('9月13日（日）')
    expect(html).not.toContain('昨日の記録')
    expect(html).toContain('今日の連絡帳はまだありません')
    expect(html).toContain('href="/parent/notebook"')
  })

  it('shows today’s teacher and parent entries for the selected child only', () => {
    state.notebookEntries = [
      entry(),
      entry({ id: 'teacher-today', date: '2026-09-13', note: '今日の園の記録' }),
      entry({
        id: 'parent-today',
        date: '2026-09-13',
        author: 'parent',
        authorId: 'parent-1',
        note: '今日の家庭の記録',
      }),
      entry({ id: 'other-child', date: '2026-09-13', childId: 'child-2', note: '別の園児の記録' }),
    ]
    const html = renderToStaticMarkup(<ParentHome />)
    expect(html).toContain('今日の園の記録')
    expect(html).toContain('今日の家庭の記録')
    expect(html).not.toContain('昨日の記録')
    expect(html).not.toContain('別の園児の記録')
    expect(html).not.toContain('今日の連絡帳はまだありません')
  })

  it('shows an empty state when there are no entries', () => {
    expect(renderToStaticMarkup(<ParentHome />)).toContain('今日の連絡帳はまだありません')
  })
})
