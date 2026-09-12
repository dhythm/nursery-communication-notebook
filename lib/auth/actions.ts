'use server'

import { cookies } from 'next/headers'
import { getRuntimeConfig } from '@/lib/runtime-config'
import type { Role } from '@/lib/types'
import { skipRoleCookie } from './identity'
import { skipAuthentication } from './skip-provider'

export async function selectSkipRole(role: Role) {
  if (getRuntimeConfig().authMode !== 'skip')
    throw new Error('Development authentication is disabled')
  if (role !== 'parent' && role !== 'teacher') throw new Error('Invalid role')
  ;(await cookies()).set(skipRoleCookie, role, { httpOnly: true, sameSite: 'lax', path: '/' })
  return skipAuthentication.getUser()
}

export async function clearSkipRole() {
  if (getRuntimeConfig().authMode !== 'skip')
    throw new Error('Development authentication is disabled')
  ;(await cookies()).delete(skipRoleCookie)
  return skipAuthentication.getUser()
}
