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
  NotebookAction,
  NotebookSnapshot,
  Notice,
  Role,
  NotificationCategory,
  User,
} from './types'

interface StoreValue extends Omit<NotebookSnapshot, 'facilities'> {
  currentUser: User | null
  login: (role: Role) => Promise<void>
  logout: () => Promise<void>
  facilityName: (id: string) => string
  addNotebookEntry: (
    entry: Omit<NotebookEntry, 'id' | 'date' | 'author' | 'authorName'>,
  ) => Promise<void>
  addMessage: (
    message: Omit<Message, 'id' | 'senderId' | 'sender' | 'senderName' | 'time'>,
  ) => Promise<void>
  addNotice: (notice: Omit<Notice, 'id' | 'date'>) => Promise<void>
  uploadFile: (
    file: File,
    displayName: string,
    targetClassId?: string,
    purpose?: 'shared' | 'notebook',
    targetChildId?: string,
  ) => Promise<string>
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>
  updateChild: (id: string, expectedVersion: number, patch: Partial<Child>) => Promise<void>
  saveNotebookEntry: (
    entry: Omit<NotebookEntry, 'id' | 'date' | 'author' | 'authorName'> & {
      status: 'draft' | 'published'
    },
  ) => Promise<void>
  updateNotebookEntry: (
    id: string,
    expectedVersion: number,
    patch: Partial<NotebookEntry>,
  ) => Promise<void>
  withdrawNotebookEntry: (id: string, expectedVersion: number) => Promise<void>
  saveNotice: (
    notice: Omit<Notice, 'id' | 'facilityId' | 'date'> & { status: 'draft' | 'published' },
  ) => Promise<void>
  updateNotice: (id: string, expectedVersion: number, patch: Partial<Notice>) => Promise<void>
  withdrawNotice: (id: string, expectedVersion: number) => Promise<void>
  markNoticeRead: (id: string) => Promise<void>
  confirmNotice: (id: string) => Promise<void>
  updateEvent: (id: string, expectedVersion: number, patch: Partial<CalendarEvent>) => Promise<void>
  cancelEvent: (id: string, expectedVersion: number) => Promise<void>
  updateNotificationPreference: (category: NotificationCategory, enabled: boolean) => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  createClass: (name: string, schoolYear: number) => Promise<void>
  createMember: (payload: {
    name: string
    email: string
    role: Role
    jobTitle?: string
  }) => Promise<void>
  createChild: (
    payload: Extract<NotebookAction, { type: 'createChild' }>['payload'],
  ) => Promise<void>
  moveChildClass: (id: string, expectedVersion: number, classId: string) => Promise<void>
  withdrawChild: (id: string, expectedVersion: number) => Promise<void>
  assignStaffClass: (staffUserId: string, classId: string) => Promise<void>
  linkGuardianChild: (guardianUserId: string, childId: string) => Promise<void>
  endMembership: (userId: string, role: Role) => Promise<void>
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
  notificationPreferences: [],
  notifications: [],
  auditEvents: [],
  nurseryClasses: [],
  members: [],
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
  const queryScope = {
    userId: currentUser?.id ?? '',
    facilityId: currentUser?.facilityId ?? '',
    role: currentUser?.role ?? ('parent' as const),
  }
  const query = useQuery({ ...notebookQuery(queryScope), enabled: currentUser !== null })
  const mutation = useMutation(notebookMutation(client, queryScope))
  const mutate = (action: NotebookAction) =>
    mutation.mutateAsync({ ...action, commandId: crypto.randomUUID() })
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
    addNotebookEntry: (payload) => mutate({ type: 'addNotebookEntry', payload }),
    addMessage: (payload) => mutate({ type: 'addMessage', payload }),
    addNotice: (payload) => mutate({ type: 'addNotice', payload }),
    uploadFile: async (file, displayName, targetClassId, purpose = 'shared', targetChildId) => {
      const form = new FormData()
      form.set('file', file)
      form.set('displayName', displayName)
      form.set('commandId', crypto.randomUUID())
      if (targetClassId) form.set('targetClassId', targetClassId)
      if (targetChildId) form.set('targetChildId', targetChildId)
      form.set('purpose', purpose)
      const response = await fetch('/api/files', { method: 'POST', body: form })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'アップロードできませんでした。')
      }
      const result = (await response.json()) as { id: string }
      await client.invalidateQueries({ queryKey: notebookQuery(queryScope).queryKey })
      return `/api/files/${result.id}?inline=1`
    },
    addEvent: (payload) => mutate({ type: 'addEvent', payload }),
    updateChild: (id, expectedVersion, patch) =>
      mutate({ type: 'updateChild', payload: { id, expectedVersion, patch } }),
    saveNotebookEntry: (payload) => mutate({ type: 'saveNotebookEntry', payload }),
    updateNotebookEntry: (id, expectedVersion, patch) =>
      mutate({ type: 'updateNotebookEntry', payload: { id, expectedVersion, patch } }),
    withdrawNotebookEntry: (id, expectedVersion) =>
      mutate({ type: 'withdrawNotebookEntry', payload: { id, expectedVersion } }),
    saveNotice: (payload) => mutate({ type: 'saveNotice', payload }),
    updateNotice: (id, expectedVersion, patch) =>
      mutate({ type: 'updateNotice', payload: { id, expectedVersion, patch } }),
    withdrawNotice: (id, expectedVersion) =>
      mutate({ type: 'withdrawNotice', payload: { id, expectedVersion } }),
    markNoticeRead: (id) => mutate({ type: 'markNoticeRead', payload: { id } }),
    confirmNotice: (id) => mutate({ type: 'confirmNotice', payload: { id } }),
    updateEvent: (id, expectedVersion, patch) =>
      mutate({ type: 'updateEvent', payload: { id, expectedVersion, patch } }),
    cancelEvent: (id, expectedVersion) =>
      mutate({ type: 'cancelEvent', payload: { id, expectedVersion } }),
    updateNotificationPreference: (category, enabled) =>
      mutate({ type: 'updateNotificationPreference', payload: { category, enabled } }),
    markNotificationRead: (id) => mutate({ type: 'markNotificationRead', payload: { id } }),
    createClass: (name, schoolYear) =>
      mutate({ type: 'createClass', payload: { name, schoolYear } }),
    createMember: (payload) => mutate({ type: 'createMember', payload }),
    createChild: (payload) => mutate({ type: 'createChild', payload }),
    moveChildClass: (id, expectedVersion, classId) =>
      mutate({ type: 'moveChildClass', payload: { id, expectedVersion, classId } }),
    withdrawChild: (id, expectedVersion) =>
      mutate({ type: 'withdrawChild', payload: { id, expectedVersion } }),
    assignStaffClass: (staffUserId, classId) =>
      mutate({ type: 'assignStaffClass', payload: { staffUserId, classId } }),
    linkGuardianChild: (guardianUserId, childId) =>
      mutate({ type: 'linkGuardianChild', payload: { guardianUserId, childId } }),
    endMembership: (userId, role) => mutate({ type: 'endMembership', payload: { userId, role } }),
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
