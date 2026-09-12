import { auth, currentUser } from '@clerk/nextjs/server'
import { getDatabase } from '@/lib/db'
import type { AuthenticationProvider } from './provider'
import { resolveClerkUser } from './clerk-user'

export const clerkAuthentication: AuthenticationProvider = {
  async getUser() {
    const { userId } = await auth()
    if (!userId) return null

    const database = await getDatabase()
    const mapped = await resolveClerkUser(database, userId)
    if (mapped) return mapped

    const clerkUser = await currentUser()
    const primaryEmail = clerkUser?.primaryEmailAddress
    if (primaryEmail?.verification?.status !== 'verified') return null
    return resolveClerkUser(database, userId, primaryEmail.emailAddress)
  },
}
