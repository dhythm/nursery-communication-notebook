import type { User } from '@/lib/types'

/** Provider boundary: application code consumes identity without an authentication SDK. */
export interface AuthenticationProvider {
  getUser(): Promise<User | null>
}
