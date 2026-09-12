import { SignIn } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import { getRuntimeConfig } from '@/lib/runtime-config'

export default function SignInPage() {
  if (getRuntimeConfig().authMode !== 'clerk') redirect('/')
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  )
}
