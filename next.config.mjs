/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    minimumCacheTTL: 604800, // 增加缓存时间到 7 天
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
  },
  outputFileTracingRoot: import.meta.dirname,
  // output: "standalone",
  env: {
    PORT: process.env.PORT || process.argv.find(arg => arg.startsWith('-p=') || arg.startsWith('--port='))?.split('=')[1] || '3001',
  },
};

export default nextConfig;
