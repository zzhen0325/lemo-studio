#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const ROOT = process.cwd();
const GOVERNANCE_PATH = path.join(ROOT, 'config', 'asset-governance.json');
const MANIFEST_PATH = path.join(ROOT, 'config', 'cdn-assets-manifest.json');
const REDIRECTS_PATH = path.join(ROOT, 'config', 'external-asset-redirects.json');

const CDN_BASE = process.env.NODE_ENV === 'development' ? 'https://ife-cdn.tiktok-row.net' : 'https://ife-cdn.byteintl.net';
const DEFAULT_EMAIL = process.env.CDN_EMAIL || 'zzhen.0325@bytedance.com';
const DEFAULT_REGION = process.env.CDN_REGION || 'SG';
const CDN_DIR = process.env.CDN_DIR || 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/repo_migration_assets';

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

async function sha256(filePath) {
  const buf = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function uploadFile(filePath) {
  const abs = path.join(ROOT, filePath);
  const buf = await fs.readFile(abs);
  const hash = await sha256(abs);
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath, ext);
  const keyName = `${basename}_${hash.slice(0, 10)}${ext}`;

  const form = new FormData();
  form.set('dir', CDN_DIR);
  form.set('region', DEFAULT_REGION);
  form.set('fileName', keyName);
  form.set('email', DEFAULT_EMAIL);
  form.set('file', new Blob([buf], { type: mimeFromExt(filePath) }), keyName);

  const res = await fetch(`${CDN_BASE}/cdn/upload`, {
    method: 'POST',
    body: form,
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`upload failed ${filePath}: HTTP ${res.status} ${text.slice(0, 300)}`);
  }

  const cdnUrl = data?.cdnUrl;
  if (!cdnUrl || typeof cdnUrl !== 'string') {
    throw new Error(`upload failed ${filePath}: missing cdnUrl in response ${text.slice(0, 300)}`);
  }

  const url = /^https?:\/\//i.test(cdnUrl) ? cdnUrl : `https://${cdnUrl.replace(/^\/\//, '')}`;

  return {
    file: filePath,
    size: buf.length,
    sha256: hash,
    cdnUrl: url,
    fileName: keyName,
    dir: CDN_DIR,
    uploadedAt: new Date().toISOString(),
  };
}

const governance = JSON.parse(await fs.readFile(GOVERNANCE_PATH, 'utf-8'));
const targets = Array.isArray(governance.allowOversize) ? governance.allowOversize : [];

if (targets.length === 0) {
  console.log('[migrate-assets] No allowOversize targets found.');
  process.exit(0);
}

console.log('[migrate-assets] Targets:');
for (const file of targets) {
  const abs = path.join(ROOT, file);
  try {
    const stat = await fs.stat(abs);
    console.log(`- ${file} (${(stat.size / 1024 / 1024).toFixed(2)}MB)`);
  } catch {
    console.log(`- ${file} (missing)`);
  }
}

if (!apply) {
  console.log('\n[migrate-assets] Dry run. Re-run with --apply to upload and migrate.');
  process.exit(0);
}

const entries = [];
for (const file of targets) {
  const abs = path.join(ROOT, file);
  try {
    await fs.access(abs);
  } catch {
    console.warn(`[migrate-assets] skip missing file: ${file}`);
    continue;
  }

  console.log(`[migrate-assets] Uploading: ${file}`);
  const uploaded = await uploadFile(file);
  entries.push(uploaded);
  console.log(`[migrate-assets] Uploaded: ${file} -> ${uploaded.cdnUrl}`);
}

if (entries.length === 0) {
  throw new Error('[migrate-assets] No files uploaded.');
}

await fs.writeFile(
  MANIFEST_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      cdnBase: CDN_BASE,
      dir: CDN_DIR,
      entries,
    },
    null,
    2,
  ),
  'utf-8',
);

const redirects = entries
  .filter((entry) => entry.file.startsWith('public/'))
  .map((entry) => ({
    source: `/${entry.file.replace(/^public\//, '')}`,
    destination: entry.cdnUrl,
    permanent: true,
  }));

await fs.writeFile(REDIRECTS_PATH, JSON.stringify(redirects, null, 2), 'utf-8');

for (const entry of entries) {
  if (entry.file.startsWith('public/')) {
    await fs.rm(path.join(ROOT, entry.file), { force: true });
  }
}

const historyEntry = entries.find((entry) => entry.file === 'data/history.json');
if (historyEntry) {
  await fs.writeFile(path.join(ROOT, 'data', 'history.json'), '[]\n', 'utf-8');
}

governance.maxFileSizeMB = 2;
governance.allowOversize = [];
await fs.writeFile(GOVERNANCE_PATH, JSON.stringify(governance, null, 2), 'utf-8');

console.log(`\n[migrate-assets] Done. Uploaded ${entries.length} files. Manifest: ${path.relative(ROOT, MANIFEST_PATH)}`);
