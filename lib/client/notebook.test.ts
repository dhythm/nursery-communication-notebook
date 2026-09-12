import { QueryClient, MutationObserver, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { notebookQuery, notebookMutation } from './notebook'

const snapshot = {
  facilities: [],
  children: [],
  notebookEntries: [],
  notices: [],
  messages: [],
  messageDrafts: [],
  messageTemplates: [],
  sharedFiles: [],
  calendarEvents: [],
}
const parentScope = {
  userId: 'parent',
  facilityId: 'facility',
  facilitySlug: 'nijiiro',
  role: 'parent' as const,
}
const teacherScope = {
  userId: 'teacher',
  facilityId: 'facility',
  facilitySlug: 'nijiiro',
  role: 'teacher' as const,
}
afterEach(() => vi.unstubAllGlobals())

describe('notebook server cache', () => {
  it('polls for updates while a screen stays open', () => {
    expect(notebookQuery(parentScope).refetchInterval).toBe(30_000)
  })

  it('separates cached snapshots by user, facility, and role', () => {
    expect(notebookQuery(parentScope).queryKey).not.toEqual(
      notebookQuery({ ...parentScope, facilityId: 'another-facility' }).queryKey,
    )
    expect(notebookQuery(parentScope).queryKey).not.toEqual(
      notebookQuery({ ...parentScope, role: 'teacher' }).queryKey,
    )
    expect(notebookQuery(parentScope).queryKey).not.toEqual(
      notebookQuery({ ...parentScope, facilitySlug: 'himawari' }).queryKey,
    )
  })

  it('reuses fresh data for the same user and isolates another user', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => Response.json(snapshot))
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient()
    await client.fetchQuery(notebookQuery(parentScope))
    await client.fetchQuery(notebookQuery(parentScope))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/nurseries/nijiiro/notebook?page=1&limit=200',
      expect.anything(),
    )
    await client.fetchQuery(notebookQuery(teacherScope))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    client.clear()
  })

  it('invalidates the current user after saving and fetches the updated server data', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => Response.json(snapshot))
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient()
    await client.fetchQuery(notebookQuery(parentScope))
    await client.fetchQuery(notebookQuery(teacherScope))
    const observer = new QueryObserver(client, notebookQuery(parentScope))
    const unsubscribe = observer.subscribe(() => {})
    const updatedSnapshot = {
      ...snapshot,
      facilities: [{ id: 'facility', name: 'Updated', logoColor: 'blue' }],
    }
    fetchMock.mockImplementation(async () => Response.json(updatedSnapshot))
    const mutation = new MutationObserver(client, notebookMutation(client, parentScope))
    await mutation.mutate({
      commandId: 'update-child',
      type: 'updateChild',
      payload: { id: 'child', expectedVersion: 1, patch: { notes: 'updated' } },
    })
    await client.fetchQuery(notebookQuery(parentScope))
    await client.fetchQuery(notebookQuery(teacherScope))
    expect(observer.getCurrentResult().data).toEqual(updatedSnapshot)
    expect(client.getQueryData(notebookQuery(teacherScope).queryKey)).toEqual(snapshot)
    unsubscribe()
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'POST' })
    client.clear()
  })

  it('rejects a failed save without invalidating cached data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(snapshot))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient()
    await client.fetchQuery(notebookQuery(parentScope))
    const mutation = new MutationObserver(client, notebookMutation(client, parentScope))
    await expect(
      mutation.mutate({
        commandId: 'failed-update-child',
        type: 'updateChild',
        payload: { id: 'child', expectedVersion: 1, patch: {} },
      }),
    ).rejects.toThrow('保存できませんでした')
    await client.fetchQuery(notebookQuery(parentScope))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    client.clear()
  })

  it('surfaces a conflict message returned by the server', async () => {
    const updatedSnapshot = {
      ...snapshot,
      messageDrafts: [
        {
          facilityId: 'facility',
          childId: 'child',
          text: '同僚が更新した下書き',
          version: 2,
          updatedAt: '2026-09-12T10:00:00.000Z',
          updatedByName: '同僚 先生',
        },
      ],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(snapshot))
      .mockResolvedValueOnce(
        Response.json(
          { error: '他の利用者が先に更新しました。再読み込みして確認してください。' },
          { status: 409 },
        ),
      )
      .mockResolvedValue(Response.json(updatedSnapshot))
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient()
    await client.fetchQuery(notebookQuery(teacherScope))
    const observer = new QueryObserver(client, notebookQuery(teacherScope))
    const unsubscribe = observer.subscribe(() => {})
    const mutation = new MutationObserver(client, notebookMutation(client, teacherScope))
    await expect(
      mutation.mutate({
        commandId: 'stale-update',
        type: 'updateChild',
        payload: { id: 'child', expectedVersion: 1, patch: {} },
      }),
    ).rejects.toThrow('他の利用者が先に更新しました')
    expect(observer.getCurrentResult().data).toEqual(updatedSnapshot)
    unsubscribe()
    client.clear()
  })
})
