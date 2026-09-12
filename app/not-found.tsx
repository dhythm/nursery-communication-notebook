import Link from 'next/link'
import { House, MapPinOff } from 'lucide-react'
import { Card } from '@/components/ui/card'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-secondary text-secondary-foreground">
          <MapPinOff className="size-8" aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold">ページが見つかりません</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          URLを確認して、ホームへお戻りください。
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          <House className="size-4" aria-hidden="true" />
          ホームへ
        </Link>
      </Card>
    </main>
  )
}
