import { getSecurityHeaders } from './lib/security-headers.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: getSecurityHeaders(
          process.env.APP_ENV === 'production' ? 'production' : 'development',
        ),
      },
    ]
  },
}

export default nextConfig
