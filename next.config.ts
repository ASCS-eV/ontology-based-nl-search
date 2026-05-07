import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['oxigraph', 'sparqljs'],

  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }
    return config
  },
}

export default nextConfig
