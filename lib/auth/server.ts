import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { skipAuthentication } from './skip-provider'
import { clerkAuthentication } from './clerk-provider'
import { getRuntimeConfig } from '@/lib/runtime-config'
import { getDatabase } from '@/lib/db'
import { canAccessFacility } from '@/lib/facility-access'
import { facilityPagePath } from '@/lib/facility-path'
import type { Role, User } from '@/lib/types'

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const { authMode } = getRuntimeConfig()
  return (authMode === 'clerk' ? clerkAuthentication : skipAuthentication).getUser()
})

export async function getIdentity(): Promise<{ id: string; role: Role } | null> {
  const user = await getCurrentUser()
  return user ? { id: user.id, role: user.role } : null
}

export async function requireRole(role: Role) {
  const user = await getCurrentUser()
  if (!user) redirect('/')
  if (user.role !== role) redirect(facilityPagePath(user.facilitySlug, user.role))
  return user
}

export async function requireFacilityRole(facilitySlug: string, role: Role) {
  const user = await requireRole(role)
  if (!(await canAccessFacility(await getDatabase(), user, facilitySlug, role))) notFound()
  return user
}

export async function getFacilityUser(facilitySlug: string) {
  const user = await getCurrentUser()
  if (!user) return null
  return (await canAccessFacility(await getDatabase(), user, facilitySlug, user.role)) ? user : null
}
