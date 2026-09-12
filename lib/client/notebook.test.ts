import { QueryClient, MutationObserver, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { notebookQuery, notebookMutation } from './notebook'

const snapshot = {
  facilities: [],
  children: [],
  notebookEntries: [],
  notices: [],
  messages: [],
  sharedFiles: [],
  calendarEvents: [],
}
afterEach(() => vi.unstubAllGlobals())

describe('notebook server cache', () => {
  it('polls for updates while a screen stays open', () => {
    expect(notebookQuery('parent').refetchInterval).toBe(30_000)
  })

  it('reuses fresh data for the same user and isolates another user', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => Response.json(snapshot))
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient()
    await client.fetchQuery(notebookQuery('parent'))
    await client.fetchQuery(notebookQuery('parent'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await client.fetchQuery(notebookQuery('teacher'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    client.clear()
  })

  it('invalidates the current user after saving and fetches the updated server data', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => Response.json(snapshot))
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient()
    await client.fetchQuery(notebookQuery('parent'))
    await client.fetchQuery(notebookQuery('teacher'))
    const observer = new QueryObserver(client, notebookQuery('parent'))
    const unsubscribe = observer.subscribe(() => {})
    const updatedSnapshot = {
      ...snapshot,
      facilities: [{ id: 'facility', name: 'Updated', logoColor: 'blue' }],
    }
    fetchMock.mockImplementation(async () => Response.json(updatedSnapshot))
    const mutation = new MutationObserver(client, notebookMutation(client, 'parent'))
    await mutation.mutate({
      commandId: 'update-child',
      type: 'updateChild',
      payload: { id: 'child', expectedVersion: 1, patch: { notes: 'updated' } },
    })
    await client.fetchQuery(notebookQuery('parent'))
    await client.fetchQuery(notebookQuery('teacher'))
    expect(observer.getCurrentResult().data).toEqual(updatedSnapshot)
    expect(client.getQueryData(notebookQuery('teacher').queryKey)).toEqual(snapshot)
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
    await client.fetchQuery(notebookQuery('parent'))
    const mutation = new MutationObserver(client, notebookMutation(client, 'parent'))
    await expect(
      mutation.mutate({
        commandId: 'failed-update-child',
        type: 'updateChild',
        payload: { id: 'child', expectedVersion: 1, patch: {} },
      }),
    ).rejects.toThrow('保存できませんでした')
    await client.fetchQuery(notebookQuery('parent'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    client.clear()
  })

  it('surfaces a conflict message returned by the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: '他の利用者が先に更新しました。再読み込みして確認してください。' },
            { status: 409 },
          ),
        ),
    )
    const client = new QueryClient()
    const mutation = new MutationObserver(client, notebookMutation(client, 'teacher'))
    await expect(
      mutation.mutate({
        commandId: 'stale-update',
        type: 'updateChild',
        payload: { id: 'child', expectedVersion: 1, patch: {} },
      }),
    ).rejects.toThrow('他の利用者が先に更新しました')
  })
})
