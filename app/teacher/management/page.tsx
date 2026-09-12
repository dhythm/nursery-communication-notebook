'use client'

import { useState, type FormEvent } from 'react'
import { PageTitle } from '@/components/teacher/page-title'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useStore } from '@/lib/store'
import type { Role } from '@/lib/types'

const selectClass = 'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm'

export default function ManagementPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageTitle title="運用管理" subtitle="入退園、クラス、利用者と担当を管理します" />
      <div className="grid gap-4 lg:grid-cols-3">
        <ClassForm />
        <MemberForm />
        <ChildForm />
      </div>
      <ChildrenSection />
      <MembersSection />
    </div>
  )
}

function ClassForm() {
  const { createClass } = useStore()
  const [name, setName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await createClass(name.trim(), year)
      setName('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '追加できませんでした')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card className="p-4">
      <h2 className="font-bold">クラスを追加</h2>
      <form className="mt-3 space-y-3" onSubmit={submit}>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <label className="block text-sm font-semibold">
          クラス名
          <Input
            className="mt-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          年度
          <Input
            className="mt-1"
            type="number"
            min="2000"
            max="2200"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            required
          />
        </label>
        <Button type="submit" className="w-full" disabled={saving}>
          追加
        </Button>
      </form>
    </Card>
  )
}

function MemberForm() {
  const { createMember } = useStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('parent')
  const [jobTitle, setJobTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await createMember({
        name: name.trim(),
        email: email.trim(),
        role,
        jobTitle: role === 'teacher' ? jobTitle.trim() || undefined : undefined,
      })
      setName('')
      setEmail('')
      setJobTitle('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '追加できませんでした')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card className="p-4">
      <h2 className="font-bold">利用者を追加</h2>
      <form className="mt-3 space-y-3" onSubmit={submit}>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <label className="block text-sm font-semibold">
          氏名
          <Input
            className="mt-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          メールアドレス
          <Input
            className="mt-1"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          区分
          <select
            className={`${selectClass} mt-1`}
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            <option value="parent">保護者</option>
            <option value="teacher">職員</option>
          </select>
        </label>
        {role === 'teacher' && (
          <label className="block text-sm font-semibold">
            役職
            <Input
              className="mt-1"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
          </label>
        )}
        <Button type="submit" className="w-full" disabled={saving}>
          追加
        </Button>
      </form>
    </Card>
  )
}

function ChildForm() {
  const { nurseryClasses, members, createChild } = useStore()
  const guardians = members.filter((member) => member.role === 'parent')
  const [name, setName] = useState('')
  const [kana, setKana] = useState('')
  const [birthday, setBirthday] = useState('')
  const [classId, setClassId] = useState('')
  const [guardianId, setGuardianId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!classId || saving) return
    setSaving(true)
    setError('')
    try {
      await createChild({
        name: name.trim(),
        kana: kana.trim(),
        birthday,
        classId,
        avatarColor: 'oklch(0.72 0.12 250)',
        allergies: [],
        notes: '',
        guardianUserIds: guardianId ? [guardianId] : [],
      })
      setName('')
      setKana('')
      setBirthday('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登録できませんでした')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card className="p-4">
      <h2 className="font-bold">園児を入園登録</h2>
      <form className="mt-3 space-y-3" onSubmit={submit}>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <label className="block text-sm font-semibold">
          氏名
          <Input
            className="mt-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          ふりがな
          <Input className="mt-1" value={kana} onChange={(event) => setKana(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          生年月日
          <Input
            className="mt-1"
            type="date"
            value={birthday}
            onChange={(event) => setBirthday(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          クラス
          <select
            className={`${selectClass} mt-1`}
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            required
          >
            <option value="">選択</option>
            {nurseryClasses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          保護者
          <select
            className={`${selectClass} mt-1`}
            value={guardianId}
            onChange={(event) => setGuardianId(event.target.value)}
          >
            <option value="">後で設定</option>
            {guardians.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="w-full" disabled={saving}>
          入園登録
        </Button>
      </form>
    </Card>
  )
}

function ChildrenSection() {
  const { children, nurseryClasses, moveChildClass, withdrawChild } = useStore()
  return (
    <section>
      <h2 className="mb-2 font-bold">在園児とクラス</h2>
      <Card className="divide-y p-0">
        {children.map((child) => (
          <div key={child.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-48 flex-1">
              <p className="font-semibold">{child.name}</p>
              <p className="text-xs text-muted-foreground">{child.kana}</p>
            </div>
            <select
              aria-label={`${child.name}のクラス`}
              className="h-9 rounded-xl border bg-background px-3 text-sm"
              value={child.classId}
              onChange={(event) =>
                void moveChildClass(child.id, child.version ?? 1, event.target.value)
              }
            >
              {nurseryClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() =>
                window.confirm(`${child.name}を退園にしますか？`) &&
                void withdrawChild(child.id, child.version ?? 1)
              }
            >
              退園
            </Button>
          </div>
        ))}
      </Card>
    </section>
  )
}

function MembersSection() {
  const {
    currentUser,
    members,
    children,
    nurseryClasses,
    assignStaffClass,
    linkGuardianChild,
    endMembership,
  } = useStore()
  return (
    <section>
      <h2 className="mb-2 font-bold">利用者と担当</h2>
      <Card className="divide-y p-0">
        {members.map((member) => (
          <MemberRow
            key={`${member.id}-${member.role}`}
            member={member}
            disabled={member.id === currentUser?.id}
            classes={nurseryClasses}
            childOptions={children}
            onAssign={assignStaffClass}
            onLink={linkGuardianChild}
            onEnd={endMembership}
          />
        ))}
      </Card>
    </section>
  )
}

function MemberRow({
  member,
  disabled,
  classes,
  childOptions,
  onAssign,
  onLink,
  onEnd,
}: {
  member: ReturnType<typeof useStore>['members'][number]
  disabled: boolean
  classes: ReturnType<typeof useStore>['nurseryClasses']
  childOptions: ReturnType<typeof useStore>['children']
  onAssign: (userId: string, classId: string) => Promise<void>
  onLink: (userId: string, childId: string) => Promise<void>
  onEnd: (userId: string, role: Role) => Promise<void>
}) {
  const [targetId, setTargetId] = useState('')
  const options = member.role === 'teacher' ? classes : childOptions
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-48 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{member.name}</p>
          <Badge>{member.role === 'teacher' ? '職員' : '保護者'}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{member.email}</p>
      </div>
      <select
        aria-label={`${member.name}の${member.role === 'teacher' ? '担当クラス' : '園児'}`}
        className="h-9 rounded-xl border bg-background px-3 text-sm"
        value={targetId}
        onChange={(event) => setTargetId(event.target.value)}
      >
        <option value="">選択</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        disabled={!targetId}
        onClick={() =>
          targetId &&
          void (member.role === 'teacher'
            ? onAssign(member.id, targetId)
            : onLink(member.id, targetId))
        }
      >
        紐づけ
      </Button>
      <Button
        variant="outline"
        disabled={disabled}
        className="text-destructive"
        onClick={() =>
          window.confirm(`${member.name}の利用を終了しますか？`) &&
          void onEnd(member.id, member.role)
        }
      >
        利用終了
      </Button>
    </div>
  )
}
