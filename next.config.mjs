/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
