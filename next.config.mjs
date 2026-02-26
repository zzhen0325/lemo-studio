import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

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

function loadExternalAssetRedirects() {
  try {
    const redirectsPath = path.join(import.meta.dirname, 'config', 'external-asset-redirects.json');
    if (!fs.existsSync(redirectsPath)) {
      return [];
    }
    const content = fs.readFileSync(redirectsPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => item && item.source && item.destination);
  } catch (error) {
    console.warn('[next.config] Failed to load external asset redirects:', error);
    return [];
  }
}

function parseCsvEnv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildImageRemotePatterns() {
  const defaultHosts = [
    'ife-cdn.tiktok-row.net',
    'ife-cdn.byteintl.net',
    '**.tiktokcdn.com',
    '**.byteimg.com',
    '**.byteintl.net',
    '**.coze.cn',
    'localhost',
    '127.0.0.1',
  ];

  const hosts = parseCsvEnv(process.env.NEXT_IMAGE_ALLOWED_HOSTS);
  const finalHosts = hosts.length > 0 ? hosts : defaultHosts;
  const patterns = [];

  for (const hostname of finalHosts) {
    patterns.push({ protocol: 'https', hostname });
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      patterns.push({ protocol: 'http', hostname });
    }
  }

  return patterns;
}

const guluxApiBase = (
  process.env.GULUX_API_BASE ||
  'http://127.0.0.1:3000/api'
).replace(/\/$/, '');

const legacyStudioRouteRedirects = [
  { source: '/playground', destination: '/studio/playground', permanent: false },
  { source: '/mapping-editor', destination: '/studio/mapping-editor', permanent: false },
  { source: '/gallery', destination: '/studio/gallery', permanent: false },
  { source: '/tools', destination: '/studio/tools', permanent: false },
  { source: '/dataset', destination: '/studio/dataset', permanent: false },
  { source: '/settings', destination: '/studio/settings', permanent: false },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      ...legacyStudioRouteRedirects,
      ...loadExternalAssetRedirects(),
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${guluxApiBase}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: buildImageRemotePatterns(),
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
