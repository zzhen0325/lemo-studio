/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3000',
      },
    ],
    minimumCacheTTL: 604800, // 增加缓存时间到 7 天
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
  },
  outputFileTracingRoot: import.meta.dirname,
  experimental: {
    optimizePackageImports: ['lucide-react', 'lucide'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push(
        '@napi-rs/snappy-darwin-arm64',
        'snappy',
        'mongoose',
        'mongodb',
        'node-unix-socket',
        'node-unix-socket-darwin-arm64',
        '@byted-nodex/metrics',
        '@gulux/plugin-typegoose',
        '@gulux/gulux'
      );
    }
    return config;
  },
  // output: "standalone",
  env: {
    PORT: process.env.PORT || process.argv.find(arg => arg.startsWith('-p=') || arg.startsWith('--port='))?.split('=')[1] || '3001',
  },
};

export default nextConfig;
