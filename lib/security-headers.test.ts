import { describe, expect, it } from 'vitest'
import { getSecurityHeaders } from './security-headers.mjs'
import nextConfig from '../next.config.mjs'

function toRecord(headers: ReturnType<typeof getSecurityHeaders>) {
  return Object.fromEntries(headers.map(({ key, value }) => [key, value]))
}

describe('security headers', () => {
  it('applies the headers to every route', async () => {
    expect(await nextConfig.headers?.()).toEqual([
      {
        source: '/:path*',
        headers: getSecurityHeaders('development'),
      },
    ])
  })

  it('protects every response from common browser attacks', () => {
    expect(toRecord(getSecurityHeaders('development'))).toMatchObject({
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    })
  })

  it('enables transport security only in production', () => {
    expect(toRecord(getSecurityHeaders('development'))).not.toHaveProperty(
      'Strict-Transport-Security',
    )
    expect(toRecord(getSecurityHeaders('production'))).toHaveProperty(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    )
  })
})
