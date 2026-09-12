import { SignUp } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import { getRuntimeConfig } from '@/lib/runtime-config'

export default function SignUpPage() {
  if (getRuntimeConfig().authMode !== 'clerk') redirect('/')
  return (
    <div className="flex min-h-full items-center justify-center bg-muted/40 p-4">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  )
}
