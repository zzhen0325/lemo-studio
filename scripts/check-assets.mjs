#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const maxMbArg = process.argv.find((arg) => arg.startsWith('--max-mb='));

const configPath = path.join(process.cwd(), 'config', 'asset-governance.json');
let config = {
  maxFileSizeMB: 5,
  trackedScopes: ['public/', 'data/', 'workflows/', 'server/workflows/'],
  allowOversize: [],
};

try {
  const raw = await fs.readFile(configPath, 'utf-8');
  const parsed = JSON.parse(raw);
  config = {
    ...config,
    ...parsed,
    trackedScopes: Array.isArray(parsed.trackedScopes) ? parsed.trackedScopes : config.trackedScopes,
    allowOversize: Array.isArray(parsed.allowOversize) ? parsed.allowOversize : config.allowOversize,
  };
} catch {
  // Use defaults if config is missing.
}

const maxMb = maxMbArg ? Number(maxMbArg.split('=')[1]) : Number(process.env.ASSET_MAX_MB || config.maxFileSizeMB || 5);
const maxBytes = Number.isFinite(maxMb) && maxMb > 0 ? maxMb * 1024 * 1024 : 5 * 1024 * 1024;
const scopePrefixes = config.trackedScopes;
const allowOversize = new Set(config.allowOversize);

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function inScope(filePath) {
  return scopePrefixes.some((prefix) => filePath.startsWith(prefix));
}

function isLikelyAsset(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const known = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.mov', '.webm', '.avif', '.heic', '.json', '.ttf', '.otf', '.woff', '.woff2', '.zip', '.bin', '.safetensors',
  ]);
  return known.has(ext) || filePath.includes('/dataset/') || filePath.includes('/loras/');
}

function getTrackedFiles() {
  const output = execSync('git ls-files -z', { encoding: 'utf8' });
  return output
    .split('\0')
    .map((file) => file.trim())
    .filter(Boolean);
}

const trackedFiles = getTrackedFiles().filter((file) => inScope(file) && isLikelyAsset(file));

const oversized = [];
const oversizedAllowlisted = [];
let totalScopedBytes = 0;

for (const file of trackedFiles) {
  try {
    const stat = await fs.stat(path.join(process.cwd(), file));
    totalScopedBytes += stat.size;
    if (stat.size > maxBytes) {
      if (allowOversize.has(file)) {
        oversizedAllowlisted.push({ file, size: stat.size });
      } else {
        oversized.push({ file, size: stat.size });
      }
    }
  } catch {
    // ignore removed or unreadable files
  }
}

oversized.sort((a, b) => b.size - a.size);

console.log(`[check-assets] Scoped files: ${trackedFiles.length}`);
console.log(`[check-assets] Total scoped size: ${formatMb(totalScopedBytes)}`);
console.log(`[check-assets] Oversize threshold: ${formatMb(maxBytes)}`);

if (oversized.length === 0) {
  console.log('[check-assets] No oversized tracked asset files found.');
} else {
  console.log('\n[check-assets] Oversized assets:');
  for (const item of oversized.slice(0, 50)) {
    console.log(`- ${item.file} (${formatMb(item.size)})`);
  }
  if (oversized.length > 50) {
    console.log(`- ... and ${oversized.length - 50} more`);
  }
}

if (oversizedAllowlisted.length > 0) {
  console.log(`\n[check-assets] Oversized but allowlisted: ${oversizedAllowlisted.length}`);
}

if (strict && oversized.length > 0) {
  process.exit(1);
}
