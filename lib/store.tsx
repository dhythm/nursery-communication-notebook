'use client'

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { selectSkipRole, clearSkipRole } from '@/lib/auth/actions'
import { notebookMutation, notebookQuery } from '@/lib/client/notebook'
import type {
  CalendarEvent,
  Child,
  Message,
  NotebookEntry,
  NotebookSnapshot,
  Notice,
  Role,
  SharedFile,
  User,
} from './types'

interface StoreValue extends Omit<NotebookSnapshot, 'facilities'> {
  currentUser: User | null
  login: (role: Role) => Promise<void>
  logout: () => Promise<void>
  facilityName: (id: string) => string
  addNotebookEntry: (entry: Omit<NotebookEntry, 'id'>) => Promise<void>
  addMessage: (message: Omit<Message, 'id'>) => Promise<void>
  addNotice: (notice: Omit<Notice, 'id'>) => Promise<void>
  addFile: (file: Omit<SharedFile, 'id'>) => Promise<void>
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>
  updateChild: (id: string, patch: Partial<Child>) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)
const emptySnapshot: NotebookSnapshot = {
  facilities: [],
  children: [],
  notebookEntries: [],
  notices: [],
  messages: [],
  sharedFiles: [],
  calendarEvents: [],
}
interface StoreProps {
  children: ReactNode
  initialUser: User | null
  authMode: 'skip'
}

export function StoreProvider(props: StoreProps) {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <ApplicationStoreProvider {...props} />
    </QueryClientProvider>
  )
}

function ApplicationStoreProvider({ children: nodes, initialUser }: StoreProps) {
  const [currentUser, setCurrentUser] = useState(initialUser)
  const client = useQueryClient()
  const router = useRouter()
  const query = useQuery({ ...notebookQuery(currentUser?.id ?? ''), enabled: currentUser !== null })
  const mutation = useMutation(notebookMutation(client, currentUser?.id ?? ''))
  const snapshot = query.data ?? emptySnapshot

  const login = async (role: Role) => {
    const user = await selectSkipRole(role)
    client.clear()
    setCurrentUser(user)
  }
  const logout = async () => {
    const user = await clearSkipRole()
    setCurrentUser(user)
    client.clear()
    router.replace('/')
    router.refresh()
  }

  const value: StoreValue = {
    ...snapshot,
    currentUser,
    login,
    logout,
    facilityName: (id) => snapshot.facilities.find((facility) => facility.id === id)?.name ?? '',
    addNotebookEntry: (payload) => mutation.mutateAsync({ type: 'addNotebookEntry', payload }),
    addMessage: (payload) => mutation.mutateAsync({ type: 'addMessage', payload }),
    addNotice: (payload) => mutation.mutateAsync({ type: 'addNotice', payload }),
    addFile: (payload) => mutation.mutateAsync({ type: 'addFile', payload }),
    addEvent: (payload) => mutation.mutateAsync({ type: 'addEvent', payload }),
    updateChild: (id, patch) =>
      mutation.mutateAsync({ type: 'updateChild', payload: { id, patch } }),
  }

  if (currentUser && query.isPending)
    return (
      <p role="status" className="p-8 text-center">
        読み込み中…
      </p>
    )
  if (currentUser && query.isError && !query.data)
    return (
      <div role="alert" className="space-y-3 p-8 text-center">
        <p>データを取得できませんでした</p>
        <button onClick={() => void query.refetch()}>再読み込み</button>
      </div>
    )
  return <StoreContext.Provider value={value}>{nodes}</StoreContext.Provider>
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used within StoreProvider')
  return context
}
