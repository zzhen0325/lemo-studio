import path from 'path';
import fs from 'fs';

function normalizeRedirectLiteralPath(source) {
  const raw = typeof source === 'string' ? source : '';
  if (!raw) return raw;

  try {
    const encoded = encodeURI(decodeURI(raw));
    // Next redirect sources use path-to-regexp syntax, so literal special chars
    // in asset file names need escaping before they are returned here.
    return encoded.replace(/([\\:+*?()[\]{}!])/g, '\\$1');
  } catch {
    return raw.replace(/([\\:+*?()[\]{}!])/g, '\\$1');
  }
}

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
    return parsed
      .filter((item) => item && item.source && item.destination)
      .map((item) => ({
        ...item,
        source: normalizeRedirectLiteralPath(item.source),
      }));
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

function parseBooleanEnv(value, defaultValue = false) {
  if (typeof value !== 'string') return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function buildImageRemotePatterns() {
  const defaultHosts = [
    'ife-cdn.tiktok-row.net',
    'ife-cdn.byteintl.net',
    '**.tiktokcdn.com',
    '**.byteimg.com',
    '**.byteintl.net',
    '**.coze.cn',
    '**.fn-boe.bytedance.net',
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

const disableNextImageOptimization = parseBooleanEnv(
  process.env.NEXT_DISABLE_IMAGE_OPTIMIZATION,
  true
);

if (process.env.NODE_ENV === 'production' && !disableNextImageOptimization) {
  console.warn('[next.config] NEXT_DISABLE_IMAGE_OPTIMIZATION=false enables the Next image optimizer. This can cause 504s when the frontend runtime cannot reach remote CDN assets reliably.');
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
    // Remote CDN images regularly 504 behind the BOE gateway when routed through
    // Next's optimizer. Default to direct browser loading and allow opt-in.
    unoptimized: disableNextImageOptimization,
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
