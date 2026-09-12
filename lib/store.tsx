'use client'

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { signOut as authjsSignOut } from 'next-auth/react'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { AppLoading } from '@/components/app-loading'
import { selectSkipRole, clearSkipRole } from '@/lib/auth/actions'
import { notebookMutation, notebookQuery } from '@/lib/client/notebook'
import type {
  CalendarEvent,
  Child,
  Message,
  MessageDraft,
  MessageTemplate,
  NotebookEntry,
  NotebookAction,
  NotebookSnapshot,
  Notice,
  Role,
  NotificationCategory,
  User,
} from './types'
import type { AuthMode } from './runtime-config'

interface StoreValue extends Omit<NotebookSnapshot, 'facilities'> {
  currentUser: User | null
  login: (role: Role) => Promise<User>
  logout: () => Promise<void>
  facilityName: (id: string) => string
  addNotebookEntry: (
    entry: Omit<NotebookEntry, 'id' | 'date' | 'author' | 'authorName'> & { date?: string },
  ) => Promise<void>
  addMessage: (
    message: Omit<Message, 'id' | 'senderId' | 'sender' | 'senderName' | 'time'>,
  ) => Promise<void>
  saveMessageDraft: (
    draft: Pick<MessageDraft, 'childId' | 'text'> & { expectedVersion: number },
  ) => Promise<void>
  createMessageTemplate: (template: Pick<MessageTemplate, 'name' | 'text'>) => Promise<void>
  deleteMessageTemplate: (id: string) => Promise<void>
  addNotice: (notice: Omit<Notice, 'id' | 'date'>) => Promise<void>
  uploadFile: (
    file: File,
    displayName: string,
    targetClassId?: string,
    purpose?: 'shared' | 'notebook',
    targetChildId?: string,
  ) => Promise<string>
  deleteFile: (id: string) => Promise<void>
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>
  updateChild: (id: string, expectedVersion: number, patch: Partial<Child>) => Promise<void>
  saveNotebookEntry: (
    entry: Omit<NotebookEntry, 'id' | 'date' | 'author' | 'authorName'> & {
      date?: string
      status: 'draft' | 'published'
    },
  ) => Promise<void>
  updateNotebookEntry: (
    id: string,
    expectedVersion: number,
    patch: Partial<NotebookEntry>,
  ) => Promise<void>
  withdrawNotebookEntry: (id: string, expectedVersion: number) => Promise<void>
  confirmNotebookEntry: (id: string, expectedVersion: number) => Promise<void>
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
  messageDrafts: [],
  messageTemplates: [],
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
  authMode: AuthMode
}

export function StoreProvider(props: StoreProps) {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <ApplicationStoreProvider {...props} />
    </QueryClientProvider>
  )
}

function ApplicationStoreProvider({ children: nodes, initialUser, authMode }: StoreProps) {
  const [currentUser, setCurrentUser] = useState(initialUser)
  const client = useQueryClient()
  const router = useRouter()
  const queryScope = {
    userId: currentUser?.id ?? '',
    facilityId: currentUser?.facilityId ?? '',
    facilitySlug: currentUser?.facilitySlug ?? '',
    role: currentUser?.role ?? ('parent' as const),
  }
  const query = useQuery({ ...notebookQuery(queryScope), enabled: currentUser !== null })
  const mutation = useMutation(notebookMutation(client, queryScope))
  const mutate = (action: NotebookAction) =>
    mutation.mutateAsync({ ...action, commandId: crypto.randomUUID() })
  const snapshot = query.data ?? emptySnapshot

  const login = async (role: Role) => {
    if (authMode !== 'skip') throw new Error('Development authentication is disabled')
    const user = await selectSkipRole(role)
    client.clear()
    setCurrentUser(user)
    return user
  }
  const logout = async () => {
    if (authMode === 'clerk') {
      client.clear()
      setCurrentUser(null)
      router.push('/sign-out')
      return
    }
    if (authMode === 'authjs') {
      client.clear()
      setCurrentUser(null)
      await authjsSignOut({ callbackUrl: '/' })
      return
    }
    const user = await clearSkipRole()
    setCurrentUser(user)
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
    saveMessageDraft: (payload) => mutate({ type: 'saveMessageDraft', payload }),
    createMessageTemplate: (payload) => mutate({ type: 'createMessageTemplate', payload }),
    deleteMessageTemplate: (id) => mutate({ type: 'deleteMessageTemplate', payload: { id } }),
    addNotice: (payload) => mutate({ type: 'addNotice', payload }),
    uploadFile: async (file, displayName, targetClassId, purpose = 'shared', targetChildId) => {
      const form = new FormData()
      form.set('file', file)
      form.set('displayName', displayName)
      form.set('commandId', crypto.randomUUID())
      if (targetClassId) form.set('targetClassId', targetClassId)
      if (targetChildId) form.set('targetChildId', targetChildId)
      form.set('purpose', purpose)
      if (!currentUser) throw new Error('ログインしてください。')
      const response = await fetch(`/api/nurseries/${currentUser.facilitySlug}/files`, {
        method: 'POST',
        body: form,
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'アップロードできませんでした。')
      }
      const result = (await response.json()) as { id: string }
      await client.invalidateQueries({ queryKey: notebookQuery(queryScope).queryKey })
      return `/api/nurseries/${currentUser.facilitySlug}/files/${result.id}?inline=1`
    },
    deleteFile: async (id) => {
      if (!currentUser) throw new Error('ログインしてください。')
      const response = await fetch(
        `/api/nurseries/${currentUser.facilitySlug}/files/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commandId: crypto.randomUUID() }),
        },
      )
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? '削除できませんでした。')
      }
      await client.invalidateQueries({ queryKey: notebookQuery(queryScope).queryKey })
    },
    addEvent: (payload) => mutate({ type: 'addEvent', payload }),
    updateChild: (id, expectedVersion, patch) =>
      mutate({ type: 'updateChild', payload: { id, expectedVersion, patch } }),
    saveNotebookEntry: (payload) => mutate({ type: 'saveNotebookEntry', payload }),
    updateNotebookEntry: (id, expectedVersion, patch) =>
      mutate({ type: 'updateNotebookEntry', payload: { id, expectedVersion, patch } }),
    withdrawNotebookEntry: (id, expectedVersion) =>
      mutate({ type: 'withdrawNotebookEntry', payload: { id, expectedVersion } }),
    confirmNotebookEntry: (id, expectedVersion) =>
      mutate({ type: 'confirmNotebookEntry', payload: { id, expectedVersion } }),
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

  if (currentUser && query.isPending) return <AppLoading />
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
