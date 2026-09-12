import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'

const authenticateWithClerk = clerkMiddleware()

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (process.env.AUTH_MODE !== 'clerk') return NextResponse.next()
  return authenticateWithClerk(request, event)
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
