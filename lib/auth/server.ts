import 'server-only'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { skipAuthentication } from './skip-provider'
import { getRuntimeConfig } from '@/lib/runtime-config'
import type { Role, User } from '@/lib/types'

export const getCurrentUser = cache(async (): Promise<User | null> => {
  getRuntimeConfig()
  return skipAuthentication.getUser()
})

export async function getIdentity(): Promise<{ id: string; role: Role } | null> {
  const user = await getCurrentUser()
  return user ? { id: user.id, role: user.role } : null
}

export async function requireRole(role: Role) {
  const identity = await getIdentity()
  if (!identity) redirect('/')
  if (identity.role !== role) redirect(`/${identity.role}`)
  return identity
}
