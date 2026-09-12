import { SettingsBackLink } from '@/components/parent/settings-back-link'

export default function PrivacyPage() {
  return (
    <Policy title="プライバシーとセキュリティ">
      園児・保護者の情報は、園との連絡および保育業務のためにのみ利用します。アクセス権限は所属園と紐づく園児に限定され、操作履歴を記録します。
    </Policy>
  )
}

function Policy({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="space-y-4 p-4">
      <SettingsBackLink />
      <h1 className="font-display text-xl font-bold">{title}</h1>
      <p className="text-sm leading-7">{children}</p>
    </article>
  )
}
