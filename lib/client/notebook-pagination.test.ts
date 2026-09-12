import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { notebookQuery } from './notebook'

const scope = {
  userId: 'teacher',
  facilityId: 'facility',
  facilitySlug: 'nijiiro',
  role: 'teacher' as const,
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    facilities: [{ id: 'facility', name: 'にじいろ保育園' }],
    children: [],
    notebookEntries: [],
    notices: [],
    messages: [],
    messageTemplates: [],
    sharedFiles: [],
    calendarEvents: [],
    notificationPreferences: [],
    notifications: [],
    auditEvents: [],
    nurseryClasses: [],
    members: [],
    ...overrides,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('notebook pagination', () => {
  it('loads and combines records beyond the first 200 without duplicating snapshot data', async () => {
    const firstMessages = Array.from({ length: 200 }, (_, index) => ({
      id: `message-${200 - index}`,
      time: `2026-09-12T${String(index).padStart(2, '0')}:00:00.000Z`,
    })).reverse()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          snapshot({
            notebookEntries: Array.from({ length: 200 }, (_, index) => ({
              id: `entry-${index + 1}`,
            })),
            messages: firstMessages,
          }),
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          snapshot({
            notebookEntries: [{ id: 'entry-201' }],
            messages: [{ id: 'message-older', time: '2026-01-01T00:00:00.000Z' }],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const client = new QueryClient()
    const result = await client.fetchQuery(notebookQuery(scope))

    expect(result.notebookEntries).toHaveLength(201)
    expect(result.notebookEntries.at(-1)?.id).toBe('entry-201')
    expect(result.messages).toHaveLength(201)
    expect(result.messages[0].id).toBe('message-older')
    expect(result.facilities).toHaveLength(1)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/nurseries/nijiiro/notebook?page=1&limit=200',
      expect.anything(),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/nurseries/nijiiro/notebook?page=2&limit=200',
      expect.anything(),
    )
    client.clear()
  })
})
