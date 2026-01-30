import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

// 获取 tldraw 相关包的绝对路径，确保只有一个实例
const tldrawPackages = [
  'tldraw',
  '@tldraw/editor',
  '@tldraw/ui',
  '@tldraw/utils',
  '@tldraw/state',
  '@tldraw/state-react',
  '@tldraw/store',
  '@tldraw/tlschema',
  '@tldraw/validate',
];

const tldrawAliases = Object.fromEntries(
  tldrawPackages.map((pkg) => {
    try {
      return [pkg, path.dirname(require.resolve(`${pkg}/package.json`))];
    } catch {
      return [pkg, pkg];
    }
  })
);

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
        hostname: '**',
      },
    ],
    minimumCacheTTL: 604800, // 增加缓存时间到 7 天
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
  },
  outputFileTracingRoot: import.meta.dirname,
  experimental: {
    optimizePackageImports: ['lucide-react', 'lucide', 'tldraw', '@tldraw/editor', '@tldraw/ui'],
  },
  transpilePackages: ['tldraw', '@tldraw/editor', '@tldraw/ui', '@tldraw/utils', '@tldraw/state', '@tldraw/store', '@tldraw/tlschema', '@tldraw/validate'],
  webpack: (config, { isServer }) => {
    // 添加 alias 确保 tldraw 相关包只有一个实例
    config.resolve.alias = {
      ...config.resolve.alias,
      ...tldrawAliases,
    };

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
  output: 'standalone',
  env: {
    PORT: process.env.PORT || process.argv.find(arg => arg.startsWith('-p=') || arg.startsWith('--port='))?.split('=')[1] || '3001',
  },
};

export default nextConfig;
