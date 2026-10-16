/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf.js + the native canvas renderer (protected study materials) must load
  // from node_modules at runtime, not be bundled.
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas'],
  experimental: {
    // Proxy buffers request bodies; raise the 10 MB default so 20 MB PDF uploads arrive whole.
    proxyClientMaxBodySize: '25mb',
  },
  async headers() {
    const origin = process.env.CORS_ORIGIN ?? '*'
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: origin },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-user-id, x-user-email' },
        ],
      },
    ]
  },
};

module.exports = nextConfig;
