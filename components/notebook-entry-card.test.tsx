import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { NotebookEntryCard } from './notebook-entry-card'

it('shows an unmeasured draft temperature without a dangling unit', () => {
  const html = renderToStaticMarkup(
    <NotebookEntryCard
      entry={{
        id: 'draft',
        childId: 'c1',
        date: '2026-09-14',
        author: 'parent',
        authorName: '保護者',
        mood: 'good',
        temperature: '',
        meals: '',
        nap: '',
        toilet: '',
        note: '',
        eveningMeal: 'ご飯',
        status: 'draft',
      }}
    />,
  )
  expect(html).toContain('未記入')
  expect(html).not.toContain('℃')
})
