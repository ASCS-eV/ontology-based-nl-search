/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensure oxigraph (WASM) and sparqljs run as native Node.js modules
    serverComponentsExternalPackages: ['oxigraph', 'sparqljs'],
    instrumentationHook: true,
  },

  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }

    return config
  },
}

module.exports = nextConfig
