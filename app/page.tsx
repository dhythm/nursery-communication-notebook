'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import { HeartHandshake, Lock, Mail, School } from 'lucide-react'
import { BrandLogo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStore } from '@/lib/store'
import type { Role } from '@/lib/types'
import { cn } from '@/lib/utils'

const demoAccounts: Record<Role, { email: string; password: string; label: string; hint: string }> =
  {
    parent: {
      email: 'sakura@example.com',
      password: 'demo1234',
      label: '保護者としてログイン',
      hint: '田中さくら さん（ひなた・あおい の保護者）',
    },
    teacher: {
      email: 'yamada@nijiiro.ed.jp',
      password: 'demo1234',
      label: '保育士としてログイン',
      hint: '山田めぐみ 先生（そら組 担任）',
    },
  }

export default function LoginPage() {
  const router = useRouter()
  const { login } = useStore()
  const [role, setRole] = useState<Role>('parent')
  const account = demoAccounts[role]
  const [email, setEmail] = useState(account.email)
  const [password, setPassword] = useState(account.password)

  function switchRole(next: Role) {
    setRole(next)
    setEmail(demoAccounts[next].email)
    setPassword(demoAccounts[next].password)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    login(role)
    router.push(role === 'parent' ? '/parent' : '/teacher')
  }

  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      <section className="relative flex flex-col justify-center gap-6 bg-secondary px-6 py-10 lg:w-1/2 lg:px-14">
        <BrandLogo />
        <div className="space-y-3">
          <h1 className="text-balance font-display text-3xl font-bold leading-tight text-secondary-foreground lg:text-4xl">
            保育園と保護者を、
            <br />
            やさしくつなぐ連絡帳
          </h1>
          <p className="max-w-md text-pretty leading-relaxed text-secondary-foreground/80">
            毎日のお子さまの様子、連絡帳、お知らせ、資料の共有までひとつのアプリで。園と家庭のコミュニケーションをもっとかんたんに。
          </p>
        </div>
        <div className="relative mx-auto aspect-4/3 w-full max-w-md overflow-hidden rounded-3xl bg-card/60">
          <Image
            src="/login-hero.png"
            alt="保育士と保護者がアプリでつながっているイラスト"
            fill
            className="object-cover"
            priority
          />
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center lg:text-left">
            <h2 className="font-display text-2xl font-bold">ログイン</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ご利用の立場を選んでログインしてください
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5">
            <RoleTab
              active={role === 'parent'}
              onClick={() => switchRole('parent')}
              icon={<HeartHandshake className="size-4" />}
              label="保護者"
            />
            <RoleTab
              active={role === 'teacher'}
              onClick={() => switchRole('teacher')}
              icon={<School className="size-4" />}
              label="保育士"
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold">
                メールアドレス
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-semibold">
                パスワード
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="h-12 w-full rounded-2xl text-base font-bold">
              {account.label}
            </Button>
          </form>

          <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/50 p-4 text-sm">
            <p className="font-semibold text-foreground">デモアカウント</p>
            <p className="mt-1 text-muted-foreground">{account.hint}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              入力済みのままログインを押すとお試しいただけます。
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function RoleTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors',
        active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
