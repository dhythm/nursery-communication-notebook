import { SettingsBackLink } from '@/components/parent/settings-back-link'

export default function TermsPage() {
  return (
    <article className="space-y-4 p-4">
      <SettingsBackLink />
      <h1 className="font-display text-xl font-bold">利用規約</h1>
      <p className="text-sm leading-7">
        本サービスは園と保護者の連絡を支援するものです。アカウントの共有、第三者の情報の無断掲載、不正なアクセスを禁止します。
      </p>
    </article>
  )
}
