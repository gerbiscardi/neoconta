/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['afip.ts', 'pg', 'mysql2', 'mssql'],
  async headers() {
    return [
      {
        source: '/dashboard/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
