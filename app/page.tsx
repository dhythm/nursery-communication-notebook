import { auth } from '@clerk/nextjs/server'
import { SignOutButton } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import LoginPage from '@/components/login-page'
import { BrandLogo } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/server'
import { facilityPagePath } from '@/lib/facility-path'
import { getRuntimeConfig } from '@/lib/runtime-config'

export default async function HomePage() {
  const { authMode } = getRuntimeConfig()
  if (authMode !== 'clerk') {
    const user = authMode === 'authjs' ? await getCurrentUser() : null
    if (user) redirect(facilityPagePath(user.facilitySlug, user.role))
    return <LoginPage authMode={authMode} />
  }

  const user = await getCurrentUser()
  if (user) redirect(facilityPagePath(user.facilitySlug, user.role))
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <section className="w-full max-w-md space-y-5 rounded-3xl border bg-card p-6 text-center shadow-sm">
        <div className="flex justify-center">
          <BrandLogo />
        </div>
        <h1 className="font-display text-xl font-bold">利用登録を確認できませんでした</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          園に登録されているメールアドレスでログインしているか、園へご確認ください。
        </p>
        <SignOutButton redirectUrl="/sign-in">
          <Button variant="outline" className="w-full">
            別のアカウントでログイン
          </Button>
        </SignOutButton>
      </section>
    </main>
  )
}
