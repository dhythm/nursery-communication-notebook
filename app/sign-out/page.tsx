'use client'

import { useClerk } from '@clerk/nextjs'
import { useEffect } from 'react'
import { AppLoading } from '@/components/app-loading'

export default function SignOutPage() {
  const { signOut } = useClerk()

  useEffect(() => {
    void signOut({ redirectUrl: '/sign-in' })
  }, [signOut])

  return <AppLoading />
}
