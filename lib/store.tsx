'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  calendarEvents as seedEvents,
  children as seedChildren,
  facilities,
  messages as seedMessages,
  notebookEntries as seedEntries,
  notices as seedNotices,
  sharedFiles as seedFiles,
  users,
} from './mock-data'
import type {
  CalendarEvent,
  Child,
  Message,
  NotebookEntry,
  Notice,
  Role,
  SharedFile,
  User,
} from './types'

interface StoreValue {
  currentUser: User | null
  login: (role: Role) => void
  logout: () => void
  facilityName: (id: string) => string
  children: Child[]
  notebookEntries: NotebookEntry[]
  notices: Notice[]
  messages: Message[]
  sharedFiles: SharedFile[]
  calendarEvents: CalendarEvent[]
  addNotebookEntry: (entry: Omit<NotebookEntry, 'id'>) => void
  addMessage: (msg: Omit<Message, 'id'>) => void
  addNotice: (notice: Omit<Notice, 'id'>) => void
  addFile: (file: Omit<SharedFile, 'id'>) => void
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void
  updateChild: (id: string, patch: Partial<Child>) => void
}

const StoreContext = createContext<StoreValue | null>(null)

const uid = () => Math.random().toString(36).slice(2, 10)

export function StoreProvider({ children: nodes }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [childList, setChildList] = useState<Child[]>(seedChildren)
  const [notebookEntries, setEntries] = useState<NotebookEntry[]>(seedEntries)
  const [notices, setNotices] = useState<Notice[]>(seedNotices)
  const [messages, setMessages] = useState<Message[]>(seedMessages)
  const [sharedFiles, setFiles] = useState<SharedFile[]>(seedFiles)
  const [calendarEvents, setEvents] = useState<CalendarEvent[]>(seedEvents)

  const login = useCallback((role: Role) => {
    const user = users.find((u) => u.role === role) ?? null
    setCurrentUser(user)
  }, [])

  const logout = useCallback(() => setCurrentUser(null), [])

  const facilityName = useCallback(
    (id: string) => facilities.find((f) => f.id === id)?.name ?? '',
    [],
  )

  const addNotebookEntry = useCallback((entry: Omit<NotebookEntry, 'id'>) => {
    setEntries((prev) => [{ ...entry, id: uid() }, ...prev])
  }, [])

  const addMessage = useCallback((msg: Omit<Message, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: uid() }])
  }, [])

  const addNotice = useCallback((notice: Omit<Notice, 'id'>) => {
    setNotices((prev) => [{ ...notice, id: uid() }, ...prev])
  }, [])

  const addFile = useCallback((file: Omit<SharedFile, 'id'>) => {
    setFiles((prev) => [{ ...file, id: uid() }, ...prev])
  }, [])

  const addEvent = useCallback((event: Omit<CalendarEvent, 'id'>) => {
    setEvents((prev) => [...prev, { ...event, id: uid() }])
  }, [])

  const updateChild = useCallback((id: string, patch: Partial<Child>) => {
    setChildList((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      currentUser,
      login,
      logout,
      facilityName,
      children: childList,
      notebookEntries,
      notices,
      messages,
      sharedFiles,
      calendarEvents,
      addNotebookEntry,
      addMessage,
      addNotice,
      addFile,
      addEvent,
      updateChild,
    }),
    [
      currentUser,
      login,
      logout,
      facilityName,
      childList,
      notebookEntries,
      notices,
      messages,
      sharedFiles,
      calendarEvents,
      addNotebookEntry,
      addMessage,
      addNotice,
      addFile,
      addEvent,
      updateChild,
    ],
  )

  return <StoreContext.Provider value={value}>{nodes}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
