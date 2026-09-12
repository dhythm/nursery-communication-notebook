import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { getRuntimeConfig } from '@/lib/runtime-config'
import { getDatabase } from '@/lib/db'
import { authenticateCredentials } from '@/lib/auth/user-repository'

const credentialsSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(256),
})

export const { handlers, auth, signIn } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/' },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub
      return session
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(rawCredentials) {
        if (getRuntimeConfig().authMode !== 'authjs') return null
        const parsed = credentialsSchema.safeParse(rawCredentials)
        if (!parsed.success) return null
        const user = await authenticateCredentials(
          await getDatabase(),
          parsed.data.email,
          parsed.data.password,
        )
        return user ? { id: user.id, name: user.name, email: user.email } : null
      },
    }),
  ],
})
