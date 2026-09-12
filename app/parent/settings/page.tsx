'use client'

import Link from 'next/link'
import {
  Bell,
  ChevronRight,
  CircleUserRound,
  FileText,
  HelpCircle,
  LogOut,
  Mail,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ChildAvatar } from '@/components/ui/child-avatar'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import { ageFromBirthday } from '@/lib/format'
import { useParent } from '@/lib/parent-context'
import { useStore } from '@/lib/store'

export default function ParentSettings() {
  const {
    currentUser,
    facilityName,
    logout,
    notificationPreferences,
    updateNotificationPreference,
  } = useStore()
  const { myChildren } = useParent()
  const preference = (category: 'notice' | 'message' | 'notebook') =>
    notificationPreferences.find((item) => item.category === category)?.enabled ?? false

  if (!currentUser) return null

  async function handleLogout() {
    await logout()
  }

  return (
    <div className="space-y-6 p-4 pb-8">
      <h1 className="pt-1 font-display text-xl font-bold">設定</h1>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <CircleUserRound className="size-8 text-secondary-foreground" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold">{currentUser.name}</p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Mail className="size-3.5" />
              {currentUser.email}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {facilityName(currentUser.facilityId)}
            </p>
          </div>
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="px-1 font-display text-sm font-bold text-muted-foreground">お子さま</h2>
        <Card className="divide-y divide-border p-0">
          {myChildren.map((child) => (
            <div key={child.id} className="flex items-center gap-3 p-4">
              <ChildAvatar name={child.name} color={child.avatarColor} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{child.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {child.className}・{ageFromBirthday(child.birthday)}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          ))}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 font-display text-sm font-bold text-muted-foreground">通知</h2>
        <Card className="divide-y divide-border p-0">
          <ToggleRow
            icon={<Bell className="size-4" />}
            label="お知らせの通知"
            checked={preference('notice')}
            onChange={(enabled) => void updateNotificationPreference('notice', enabled)}
          />
          <ToggleRow
            icon={<MessageCircle className="size-4" />}
            label="メッセージの通知"
            checked={preference('message')}
            onChange={(enabled) => void updateNotificationPreference('message', enabled)}
          />
          <ToggleRow
            icon={<FileText className="size-4" />}
            label="連絡帳の更新通知"
            checked={preference('notebook')}
            onChange={(enabled) => void updateNotificationPreference('notebook', enabled)}
          />
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 font-display text-sm font-bold text-muted-foreground">その他</h2>
        <Card className="divide-y divide-border p-0">
          <LinkRow
            href="/parent/settings/privacy"
            icon={<ShieldCheck className="size-4" />}
            label="プライバシーとセキュリティ"
          />
          <LinkRow
            href="/parent/settings/help"
            icon={<HelpCircle className="size-4" />}
            label="ヘルプ・お問い合わせ"
          />
          <LinkRow
            href="/parent/settings/terms"
            icon={<FileText className="size-4" />}
            label="利用規約"
          />
        </Card>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border border-destructive/30 bg-destructive/10 py-3.5 text-sm font-bold text-destructive transition-colors hover:bg-destructive/20"
      >
        <LogOut className="size-4" />
        ログアウト
      </button>

      <p className="text-center text-xs text-muted-foreground">にじいろ連絡帳 v1.0.0（デモ）</p>
    </div>
  )
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-primary">{icon}</span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

function LinkRow({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50">
      <span className="text-primary">{icon}</span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  )
}
