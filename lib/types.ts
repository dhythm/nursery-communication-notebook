export type Role = 'parent' | 'teacher'

export interface Facility {
  id: string
  name: string
  logoColor: string
}

export interface NurseryClass {
  id: string
  facilityId: string
  name: string
  schoolYear?: number
}

export interface User {
  id: string
  role: Role
  name: string
  facilityId: string
  email: string
  childIds?: string[]
  jobTitle?: string
}

export interface Child {
  id: string
  classId: string
  name: string
  kana: string
  facilityId: string
  className: string
  birthday: string
  avatarColor: string
  allergies: string[]
  notes: string
  version?: number
  updatedAt?: string
}

export type Mood = 'genki' | 'normal' | 'tired' | 'sick'

export interface NotebookEntry {
  id: string
  childId: string
  date: string
  author: Role
  authorName: string
  mood: Mood
  temperature: string
  meals: string
  nap: string
  toilet: string
  note: string
  photo?: string
  status?: ContentStatus
  version?: number
  authorId?: string
  updatedAt?: string
}

export interface Notice {
  id: string
  facilityId: string
  title: string
  body: string
  date: string
  category: '重要' | 'イベント' | '保健' | '給食' | 'お願い'
  pinned?: boolean
  requiresConfirmation?: boolean
  status?: ContentStatus
  version?: number
  targetClassId?: string | null
  readAt?: string
  confirmedAt?: string
  recipientCount?: number
  readCount?: number
  confirmationCount?: number
}

export interface Message {
  id: string
  childId: string
  senderId?: string
  sender: Role
  senderName: string
  text: string
  time: string
}

export interface SharedFile {
  id: string
  facilityId: string
  name: string
  kind: 'PDF' | '画像' | '文書'
  sizeLabel: string
  sharedWith: 'all' | string[]
  className?: string
  date: string
  uploadedBy: string
  contentType?: string
  byteSize?: number
  downloadUrl?: string
}

export type EventType = '行事' | '面談' | '健診' | '休園' | '持ち物'

export interface CalendarEvent {
  id: string
  facilityId: string
  date: string
  title: string
  type: EventType
  time?: string
  memo?: string
  status?: ContentStatus | 'cancelled'
  version?: number
  targetClassId?: string
}

type ContentStatus = 'draft' | 'published' | 'withdrawn'
export type NotificationCategory = 'notice' | 'message' | 'notebook'

interface NotificationPreference {
  category: NotificationCategory
  enabled: boolean
}

interface AppNotification {
  id: string
  category: NotificationCategory
  title: string
  createdAt: string
  readAt?: string
  sourceType: string
  sourceId: string
}

interface AuditEvent {
  id: string
  actorName: string
  actorRole: Role | 'system'
  action: string
  entityType: string
  entityId: string
  occurredAt: string
}

interface MemberSummary {
  id: string
  name: string
  email: string
  role: Role
  jobTitle?: string
  assignedClassIds: string[]
  linkedChildIds: string[]
}

export interface NotebookSnapshot {
  facilities: Facility[]
  children: Child[]
  notebookEntries: NotebookEntry[]
  notices: Notice[]
  messages: Message[]
  sharedFiles: SharedFile[]
  calendarEvents: CalendarEvent[]
  notificationPreferences: NotificationPreference[]
  notifications: AppNotification[]
  auditEvents: AuditEvent[]
  nurseryClasses: NurseryClass[]
  members: MemberSummary[]
}

export type NotebookAction =
  | {
      type: 'addNotebookEntry'
      payload: Omit<NotebookEntry, 'id' | 'date' | 'author' | 'authorName'>
    }
  | {
      type: 'addMessage'
      payload: Omit<Message, 'id' | 'senderId' | 'sender' | 'senderName' | 'time'>
    }
  | { type: 'addNotice'; payload: Omit<Notice, 'id' | 'date'> }
  | { type: 'addEvent'; payload: Omit<CalendarEvent, 'id'> }
  | {
      type: 'saveNotebookEntry'
      payload: Omit<NotebookEntry, 'id' | 'date' | 'author' | 'authorName'> & {
        status: 'draft' | 'published'
      }
    }
  | {
      type: 'updateNotebookEntry'
      payload: {
        id: string
        expectedVersion: number
        patch: Partial<Omit<NotebookEntry, 'id' | 'date' | 'author' | 'authorName'>>
      }
    }
  | { type: 'withdrawNotebookEntry'; payload: { id: string; expectedVersion: number } }
  | {
      type: 'saveNotice'
      payload: Omit<Notice, 'id' | 'facilityId' | 'date'> & { status: 'draft' | 'published' }
    }
  | {
      type: 'updateNotice'
      payload: { id: string; expectedVersion: number; patch: Partial<Notice> }
    }
  | { type: 'withdrawNotice'; payload: { id: string; expectedVersion: number } }
  | { type: 'markNoticeRead'; payload: { id: string } }
  | { type: 'confirmNotice'; payload: { id: string } }
  | {
      type: 'updateEvent'
      payload: { id: string; expectedVersion: number; patch: Partial<CalendarEvent> }
    }
  | { type: 'cancelEvent'; payload: { id: string; expectedVersion: number } }
  | {
      type: 'updateNotificationPreference'
      payload: { category: NotificationCategory; enabled: boolean }
    }
  | { type: 'markNotificationRead'; payload: { id: string } }
  | { type: 'createClass'; payload: { name: string; schoolYear: number } }
  | {
      type: 'createMember'
      payload: { name: string; email: string; role: Role; jobTitle?: string }
    }
  | {
      type: 'createChild'
      payload: {
        name: string
        kana: string
        birthday: string
        classId: string
        avatarColor: string
        allergies: string[]
        notes: string
        guardianUserIds: string[]
      }
    }
  | { type: 'moveChildClass'; payload: { id: string; expectedVersion: number; classId: string } }
  | { type: 'withdrawChild'; payload: { id: string; expectedVersion: number } }
  | { type: 'assignStaffClass'; payload: { staffUserId: string; classId: string } }
  | { type: 'linkGuardianChild'; payload: { guardianUserId: string; childId: string } }
  | { type: 'endMembership'; payload: { userId: string; role: Role } }
  | {
      type: 'updateChild'
      payload: { id: string; expectedVersion: number; patch: Partial<Child> }
    }

export type NotebookCommand = NotebookAction & { commandId: string }
