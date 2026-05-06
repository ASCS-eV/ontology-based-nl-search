/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Oxigraph WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }

    if (isServer) {
      // Prevent Oxigraph from being bundled in edge runtime
      config.externals = config.externals || []
    }

    return config
  },
}

module.exports = nextConfig
