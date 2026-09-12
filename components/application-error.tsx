'use client'

import { useEffect } from 'react'
import { House, RefreshCcw, TriangleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function ApplicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'client_render_failed',
        error: { name: error.name, message: error.message },
        digest: error.digest,
      }),
    )
  }, [error])

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-secondary text-secondary-foreground">
          <TriangleAlert className="size-8" aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold">画面を表示できませんでした</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          通信状態を確認して、もう一度お試しください。
        </p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <Button className="h-11" variant="outline" onClick={() => router.push('/')}>
            <House aria-hidden="true" />
            ホームへ
          </Button>
          <Button className="h-11" onClick={reset}>
            <RefreshCcw aria-hidden="true" />
            もう一度試す
          </Button>
        </div>
      </Card>
    </main>
  )
}
