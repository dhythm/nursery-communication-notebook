/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
