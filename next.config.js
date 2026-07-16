/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // Le lint ne doit pas faire échouer le build de production (Vercel).
  // `npm run lint` reste disponible en développement.
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
