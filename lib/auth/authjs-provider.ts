import { auth } from '@/auth'
import { getDatabase } from '@/lib/db'
import type { AuthenticationProvider } from './provider'
import { getApplicationUser } from './user-repository'

export const authjsAuthentication: AuthenticationProvider = {
  async getUser() {
    const session = await auth()
    return session?.user?.id ? getApplicationUser(await getDatabase(), session.user.id) : null
  },
}
