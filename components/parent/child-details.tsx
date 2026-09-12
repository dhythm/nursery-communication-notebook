'use client'

import { ChildAvatar } from '@/components/ui/child-avatar'
import { Card } from '@/components/ui/card'
import { ageFromBirthday, calendarDateParts } from '@/lib/format'
import { useParent } from '@/lib/parent-context'
import { SettingsBackLink } from './settings-back-link'

export function ParentChildDetails({ childId }: { childId: string }) {
  const { myChildren } = useParent()
  const child = myChildren.find((candidate) => candidate.id === childId)
  if (!child) return null

  const birthday = calendarDateParts(child.birthday)

  return (
    <article className="space-y-5 p-4 pb-8">
      <SettingsBackLink />
      <h1 className="font-display text-xl font-bold">お子さまの情報</h1>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <ChildAvatar name={child.name} color={child.avatarColor} size={52} />
          <div>
            <p className="text-base font-bold">{child.name}</p>
            <p className="text-sm text-muted-foreground">{child.kana}</p>
          </div>
        </div>
      </Card>

      <Card className="divide-y divide-border p-0">
        <DetailRow label="クラス" value={child.className} />
        <DetailRow
          label="生年月日"
          value={`${birthday.year}年${birthday.month}月${birthday.day}日`}
        />
        <DetailRow label="年齢" value={ageFromBirthday(child.birthday)} />
        <DetailRow
          label="アレルギー"
          value={child.allergies.length > 0 ? child.allergies.join('、') : 'なし'}
        />
      </Card>
    </article>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <dl className="grid grid-cols-[6rem_1fr] gap-3 p-4 text-sm">
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </dl>
  )
}
