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
  const user = await skipAuthentication.getUser()
  if (!user) throw new Error('Development user is missing')
  return user
}

export async function clearSkipRole() {
  if (getRuntimeConfig().authMode !== 'skip')
    throw new Error('Development authentication is disabled')
  ;(await cookies()).delete(skipRoleCookie)
  return skipAuthentication.getUser()
}

export interface SignInState {
  error?: string
}

export async function signInWithCredentials(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (getRuntimeConfig().authMode !== 'authjs') return { error: 'ログインできませんでした。' }
  try {
    const { signIn } = await import('@/auth')
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/',
    })
    return {}
  } catch (error) {
    const { AuthError } = await import('next-auth')
    if (error instanceof AuthError) return { error: 'IDまたはパスワードが正しくありません。' }
    throw error
  }
}
