import { cookies } from 'next/headers'
import { getSkipRole, skipRoleCookie } from './identity'
import { users } from '@/lib/mock-data'
import type { AuthenticationProvider } from './provider'

export const skipAuthentication: AuthenticationProvider = {
  async getUser() {
    const role = getSkipRole((await cookies()).get(skipRoleCookie)?.value)
    return users.find((user) => user.role === role) ?? null
  },
}
