import { SettingsBackLink } from '@/components/parent/settings-back-link'

export default function HelpPage() {
  return (
    <article className="space-y-5 p-4 pb-8">
      <SettingsBackLink />
      <h1 className="font-display text-xl font-bold">ヘルプ</h1>
      <section className="space-y-2">
        <h2 className="font-display text-base font-bold">お子さまを切り替える</h2>
        <p className="text-sm leading-7">
          画面上部のお子さまの名前を押すと、表示するお子さまを切り替えられます。
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-base font-bold">連絡帳を送る</h2>
        <p className="text-sm leading-7">
          連絡帳画面から当日の内容を入力して送信できます。園が確認するまでは編集や送信取消ができます。
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-base font-bold">園へ連絡する</h2>
        <p className="text-sm leading-7">
          欠席、遅刻、お迎えの変更、その他の連絡はメッセージ画面から送信できます。
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-base font-bold">アプリについての問い合わせ</h2>
        <p className="text-sm leading-7">
          <a
            href="https://x.com/dhythm_dev"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary underline underline-offset-4"
          >
            X（@dhythm_dev）
          </a>
          へご連絡ください。
        </p>
      </section>
    </article>
  )
}
