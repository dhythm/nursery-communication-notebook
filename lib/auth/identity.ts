import type { Role } from '@/lib/types'

export const skipRoleCookie = 'nursery-development-role'

export function getSkipRole(value: string | undefined): Role {
  return value === 'teacher' ? 'teacher' : 'parent'
}
