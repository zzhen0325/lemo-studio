import path from 'path';
import fs from 'fs';

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
  // 禁用代理层 HTTP keep-alive，避免因 server keepAliveTimeout(5s) 导致的 ECONNRESET
  // 背景：Gemini 图片生成需要 ~30s，超过 server 默认 5s keep-alive timeout
  httpAgentOptions: {
    keepAlive: false,
  },

  async redirects() {
    return [
      ...legacyStudioRouteRedirects,
      ...loadExternalAssetRedirects(),
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
    optimizePackageImports: ['lucide-react', 'lucide'],
  },
  transpilePackages: [],
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
  output: 'standalone',
  env: {
    PORT: process.env.PORT || process.argv.find(arg => arg.startsWith('-p=') || arg.startsWith('--port='))?.split('=')[1] || '3001',
  },
};

export default nextConfig;
