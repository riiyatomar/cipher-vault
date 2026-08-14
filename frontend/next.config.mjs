import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Point to the monorepo root (parent of frontend/) to fix lockfile warning
  outputFileTracingRoot: resolve(__dirname, '..'),
  images: {
    unoptimized: true,
  },
  // Proxy /api/* to the backend in development.
  // In production on Vercel, vercel.json rewrites handle this.
  async rewrites() {
    return process.env.NODE_ENV === 'development'
      ? [
          {
            source: '/api/:path*',
            destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8008/api'}/:path*`,
          },
        ]
      : [];
  },
};

export default nextConfig;
