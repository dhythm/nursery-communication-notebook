'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import {
  Bell,
  BookOpenText,
  Check,
  ChevronDown,
  FolderOpen,
  Home,
  MessageCircle,
  Settings,
} from 'lucide-react'
import { BrandMark } from '@/components/brand'
import { ChildAvatar } from '@/components/ui/child-avatar'
import { ParentProvider, useParent } from '@/lib/parent-context'
import { useStore } from '@/lib/store'
import { ageFromBirthday } from '@/lib/format'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/parent', label: 'ホーム', icon: Home },
  { href: '/parent/notebook', label: '連絡帳', icon: BookOpenText },
  { href: '/parent/messages', label: 'メッセージ', icon: MessageCircle },
  { href: '/parent/notices', label: 'お知らせ', icon: Bell },
  { href: '/parent/files', label: '資料', icon: FolderOpen },
  { href: '/parent/settings', label: '設定', icon: Settings },
]

export function ParentShell({ children }: { children: ReactNode }) {
  const { currentUser } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'parent') router.replace('/')
  }, [currentUser, router])

  if (!currentUser || currentUser.role !== 'parent') return null

  return (
    <ParentProvider>
      <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-background shadow-xl">
        <ChildHeader />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        <BottomNav />
      </div>
    </ParentProvider>
  )
}

function ChildHeader() {
  const { facilityName, currentUser } = useStore()
  const { myChildren, selectedChild, setSelectedChildId } = useParent()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <BrandMark size={30} />
          <span className="text-xs font-semibold text-muted-foreground">
            {currentUser && facilityName(currentUser.facilityId)}
          </span>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 transition-colors hover:bg-muted"
          >
            {selectedChild && (
              <ChildAvatar name={selectedChild.name} color={selectedChild.avatarColor} size={32} />
            )}
            <span className="max-w-24 truncate text-sm font-bold">
              {selectedChild?.name.split(' ')[1] ?? selectedChild?.name}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>

          {open && (
            <>
              <button
                type="button"
                aria-label="閉じる"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-lg">
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                  お子さまを切り替え
                </p>
                {myChildren.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => {
                      setSelectedChildId(child.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted',
                      selectedChild?.id === child.id && 'bg-secondary',
                    )}
                  >
                    <ChildAvatar name={child.name} color={child.avatarColor} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{child.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {child.className}・{ageFromBirthday(child.birthday)}
                      </span>
                    </span>
                    {selectedChild?.id === child.id && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="shrink-0 border-t border-border bg-card">
      <ul className="flex items-stretch justify-around px-1 py-1.5">
        {navItems.map((item) => {
          const active =
            item.href === '/parent' ? pathname === '/parent' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[0.65rem] font-semibold transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-12 items-center justify-center rounded-full transition-colors',
                    active && 'bg-secondary',
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
