import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['oxigraph', 'sparqljs'],

  // We use our own ESLint flat config — disable Next.js's built-in lint step during build
  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }
    return config
  },
}

export default nextConfig
