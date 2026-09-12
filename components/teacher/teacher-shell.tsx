'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import {
  CalendarDays,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Megaphone,
  Users,
  ShieldCheck,
  Settings2,
} from 'lucide-react'
import { BrandLogo } from '@/components/brand'
import { useStore } from '@/lib/store'
import { useFacilityPath } from '@/lib/facility-path-client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/teacher', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/teacher/children', label: '園児管理', icon: Users },
  { href: '/teacher/messages', label: 'メッセージ', icon: MessageCircle },
  { href: '/teacher/notices', label: 'お知らせ', icon: Megaphone },
  { href: '/teacher/files', label: '資料共有', icon: FolderOpen },
  { href: '/teacher/calendar', label: 'カレンダー', icon: CalendarDays },
  { href: '/teacher/audit', label: '操作履歴', icon: ShieldCheck, managerOnly: true },
  { href: '/teacher/management', label: '運用管理', icon: Settings2, managerOnly: true },
]

export function TeacherShell({ children }: { children: ReactNode }) {
  const { currentUser, facilityName, logout } = useStore()
  const router = useRouter()
  const pathname = usePathname()
  const facilityPath = useFacilityPath()

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'teacher') router.replace('/')
  }, [currentUser, router])

  if (!currentUser || currentUser.role !== 'teacher') return null
  const visibleNavItems = navItems.filter(
    (item) => !item.managerOnly || currentUser.canManageFacility,
  )

  async function handleLogout() {
    await logout()
  }

  return (
    <div className="flex h-dvh bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="p-5">
          <BrandLogo />
        </div>
        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {visibleNavItems.map((item) => {
              const href = facilityPath(item.href)
              const active =
                item.href === '/teacher' ? pathname === href : pathname.startsWith(href)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-5" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="border-t border-border p-3">
          <div className="mb-2 rounded-2xl bg-muted/60 px-3.5 py-3">
            <p className="text-sm font-bold">{currentUser.name} 先生</p>
            <p className="text-xs text-muted-foreground">{currentUser.jobTitle}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {facilityName(currentUser.facilityId)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-5" />
            ログアウト
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <BrandLogo />
          <button
            type="button"
            onClick={handleLogout}
            aria-label="ログアウト"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
          >
            <LogOut className="size-5" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

        <nav className="shrink-0 border-t border-border bg-card md:hidden">
          <ul className="flex items-stretch justify-around px-1 py-1.5">
            {visibleNavItems.map((item) => {
              const href = facilityPath(item.href)
              const active =
                item.href === '/teacher' ? pathname === href : pathname.startsWith(href)
              const Icon = item.icon
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={href}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[0.6rem] font-semibold transition-colors',
                      active ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-11 items-center justify-center rounded-full',
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
      </div>
    </div>
  )
}
