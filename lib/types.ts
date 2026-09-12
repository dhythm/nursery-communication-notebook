export type Role = 'parent' | 'teacher'

export interface Facility {
  id: string
  name: string
  logoColor: string
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
  name: string
  kana: string
  facilityId: string
  className: string
  birthday: string
  avatarColor: string
  allergies: string[]
  notes: string
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
}

export interface Notice {
  id: string
  facilityId: string
  title: string
  body: string
  date: string
  category: '重要' | 'イベント' | '保健' | '給食' | 'お願い'
  pinned?: boolean
}

export interface Message {
  id: string
  childId: string
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
}
