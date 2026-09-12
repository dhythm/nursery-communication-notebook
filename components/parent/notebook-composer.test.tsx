import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { NotebookComposer } from './notebook-composer'

vi.mock('@/lib/store', () => ({
  useStore: () => ({ currentUser: { id: 'parent-1' }, notebookEntries: [], calendarEvents: [] }),
}))
vi.mock('@/components/parent/entry-dialog', () => ({ EntryDialog: () => null }))
afterEach(() => vi.useRealTimers())

it('starts with today in Japan and exposes tomorrow and Monday before opening the form', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T15:30:00Z'))
  const html = renderToStaticMarkup(
    <NotebookComposer
      allowDateSelection
      child={{
        id: 'child-1',
        name: '田中 ひなた',
        classId: 'class-1',
        facilityId: 'facility-1',
        className: 'そら組',
        kana: '',
        birthday: '2021-07-01',
        avatarColor: '#ffa499',
        allergies: [],
        notes: '',
      }}
    />,
  )
  expect(html).toContain('連絡帳の日付')
  expect(html).toContain('value="2026-09-13"')
  expect(html).toContain('明日')
  expect(html).toContain('次の月曜日')
  expect(html).toContain('子どもの様子を登録する')
})

it('keeps home to one action showing Monday on the weekend', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T15:30:00Z'))
  const html = renderToStaticMarkup(
    <NotebookComposer
      child={{
        id: 'child-1',
        name: '田中 ひなた',
        classId: 'class-1',
        facilityId: 'facility-1',
        className: 'そら組',
        kana: '',
        birthday: '2021-07-01',
        avatarColor: '#ffa499',
        allergies: [],
        notes: '',
      }}
    />,
  )
  expect(html).not.toContain('type="date"')
  expect(html).toContain('9月14日（月）')
  expect(html).toContain('子どもの様子を登録する')
})
