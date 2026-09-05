/** @type {import('next').NextConfig} */
const nextConfig = {
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
