#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const RUNTIME_MANIFEST_PATH = path.join(ROOT, 'config', 'runtime-cdn-manifest.json');
const REDIRECTS_PATH = path.join(ROOT, 'config', 'external-asset-redirects.json');

function loadEnvFile(filePath) {
  return fs.readFile(filePath, 'utf-8')
    .then((content) => {
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) continue;
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        if (!key || process.env[key]) continue;
        process.env[key] = value;
      }
    })
    .catch(() => {});
}

await loadEnvFile(path.join(ROOT, '.env.local'));

const CDN_BASE = process.env.CDN_BASE_URL || (process.env.NODE_ENV === 'development' ? 'https://ife-cdn.tiktok-row.net' : 'https://ife-cdn.byteintl.net');
const CDN_DIR = process.env.RUNTIME_CDN_DIR || process.env.CDN_DIR || 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/runtime_assets';
const CDN_REGION = process.env.CDN_REGION || 'SG';
const CDN_EMAIL = process.env.CDN_EMAIL || '';

if (apply && !CDN_EMAIL) {
  throw new Error('Missing CDN_EMAIL. Set it in environment or .env.local before running --apply.');
}

function normalizeRepoPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

function normalizePublicPath(filePath) {
  const normalized = normalizeRepoPath(filePath);
  return normalized.startsWith('public/') ? `/${normalized.slice('public/'.length)}` : `/${normalized}`;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function walkFiles(dirPath) {
  const result = [];
  if (!(await pathExists(dirPath))) return result;

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...await walkFiles(absolute));
    } else {
      result.push(absolute);
    }
  }
  return result;
}

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
    case '.svg':
      return 'image/svg+xml';
    case '.json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

function buildUploadFileName(repoPath, hash) {
  const normalized = normalizeRepoPath(repoPath);
  const ext = path.extname(normalized).toLowerCase();
  const base = normalized.slice(0, normalized.length - ext.length).replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `${base}_${hash.slice(0, 10)}${ext}`;
}

async function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function uploadBuffer(repoPath, buffer, mimeType) {
  const hash = await sha256(buffer);
  const fileName = buildUploadFileName(repoPath, hash);

  const form = new FormData();
  form.set('dir', CDN_DIR);
  form.set('region', CDN_REGION);
  form.set('fileName', fileName);
  form.set('email', CDN_EMAIL);
  form.set('file', new Blob([buffer], { type: mimeType }), fileName);

  const response = await fetch(`${CDN_BASE}/cdn/upload`, {
    method: 'POST',
    body: form,
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Upload failed for ${repoPath}: HTTP ${response.status} ${text.slice(0, 300)}`);
  }

  const rawUrl = data?.cdnUrl;
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    throw new Error(`Upload failed for ${repoPath}: missing cdnUrl in response ${text.slice(0, 300)}`);
  }

  const cdnUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl.replace(/^\/\//, '')}`;
  return {
    file: normalizeRepoPath(repoPath),
    cdnUrl,
    fileName,
    dir: CDN_DIR,
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
  };
}

function collectLocalRefs(value, refs) {
  if (typeof value === 'string') {
    if (value.startsWith('/') && !value.startsWith('//')) {
      refs.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectLocalRefs(item, refs));
    return;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectLocalRefs(item, refs));
  }
}

function replaceMappedRefs(value, publicUrlMap) {
  if (typeof value === 'string') {
    return publicUrlMap.get(value) || value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceMappedRefs(item, publicUrlMap));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceMappedRefs(item, publicUrlMap)]),
    );
  }

  return value;
}

function normalizeRemoteRef(ref, publicUrlMap, { dropMissing = false } = {}) {
  if (typeof ref !== 'string' || !ref) return undefined;
  if (ref.startsWith('http') || ref.startsWith('data:') || ref.startsWith('blob:')) {
    return ref;
  }
  if (ref.startsWith('/')) {
    const mapped = publicUrlMap.get(ref);
    if (mapped) return mapped;
    return dropMissing ? undefined : ref;
  }
  return ref;
}

const workflowFiles = (await walkFiles(path.join(ROOT, 'workflows')))
  .filter((absolute) => absolute.endsWith('.json'))
  .map((absolute) => normalizeRepoPath(path.relative(ROOT, absolute)))
  .sort();

const presetJsonFiles = (await walkFiles(path.join(ROOT, 'public', 'preset')))
  .filter((absolute) => absolute.endsWith('.json'))
  .map((absolute) => normalizeRepoPath(path.relative(ROOT, absolute)))
  .sort();

const styleJsonFiles = (await walkFiles(path.join(ROOT, 'public', 'styles')))
  .filter((absolute) => absolute.endsWith('.json'))
  .map((absolute) => normalizeRepoPath(path.relative(ROOT, absolute)))
  .sort();

const loraMetadataFiles = (await walkFiles(path.join(ROOT, 'public', 'loras')))
  .filter((absolute) => absolute.endsWith('.metadata.json'))
  .map((absolute) => normalizeRepoPath(path.relative(ROOT, absolute)))
  .sort();

const referencedPublicPaths = new Set();
for (const repoPath of [...presetJsonFiles, ...styleJsonFiles]) {
  if (repoPath.endsWith('categories.json')) continue;
  const absolute = path.join(ROOT, repoPath);
  try {
    const parsed = JSON.parse(await fs.readFile(absolute, 'utf-8'));
    collectLocalRefs(parsed, referencedPublicPaths);
  } catch (error) {
    console.warn(`[runtime-assets] Failed to parse ${repoPath}:`, error);
  }
}
referencedPublicPaths.add('/preset/categories.json');

const referencedPublicFiles = [...referencedPublicPaths]
  .map((publicPath) => ({ publicPath, repoPath: normalizeRepoPath(`public${publicPath}`) }))
  .sort((a, b) => a.repoPath.localeCompare(b.repoPath));

const existingReferencedPublicFiles = [];
const missingReferencedPublicFiles = [];
for (const entry of referencedPublicFiles) {
  const absolute = path.join(ROOT, entry.repoPath);
  if (await pathExists(absolute)) {
    existingReferencedPublicFiles.push(entry);
  } else {
    missingReferencedPublicFiles.push(entry);
  }
}

const loraPreviewFiles = [];
for (const metadataFile of loraMetadataFiles) {
  const previewRepoPath = metadataFile.replace(/\.metadata\.json$/, '.webp');
  if (await pathExists(path.join(ROOT, previewRepoPath))) {
    loraPreviewFiles.push(previewRepoPath);
  }
}

const filesToUpload = [
  ...workflowFiles,
  ...existingReferencedPublicFiles.map((entry) => entry.repoPath),
  ...loraPreviewFiles,
];

console.log('[runtime-assets] Workflow JSON files:', workflowFiles.length);
console.log('[runtime-assets] Referenced public assets to upload:', existingReferencedPublicFiles.length);
console.log('[runtime-assets] Lora previews to upload:', loraPreviewFiles.length);
console.log('[runtime-assets] Missing referenced public assets:', missingReferencedPublicFiles.length);

if (missingReferencedPublicFiles.length > 0) {
  for (const entry of missingReferencedPublicFiles) {
    console.log(`- missing ${entry.publicPath}`);
  }
}

if (!apply) {
  console.log('\n[runtime-assets] Dry run complete. Re-run with --apply to upload and rewrite manifests/catalogs.');
  process.exit(0);
}

const existingManifest = await readJson(RUNTIME_MANIFEST_PATH, { generatedAt: new Date(0).toISOString(), entries: [] });
const manifestEntries = new Map(
  (Array.isArray(existingManifest.entries) ? existingManifest.entries : [])
    .filter((entry) => entry && typeof entry.file === 'string' && typeof entry.cdnUrl === 'string')
    .map((entry) => [normalizeRepoPath(entry.file), entry]),
);

const publicUrlMap = new Map();
const uploadedEntries = [];

for (const repoPath of filesToUpload) {
  const absolute = path.join(ROOT, repoPath);
  const buffer = await fs.readFile(absolute);
  const uploaded = await uploadBuffer(repoPath, buffer, mimeFromExt(repoPath));
  manifestEntries.set(uploaded.file, uploaded);
  uploadedEntries.push(uploaded);

  if (uploaded.file.startsWith('public/')) {
    publicUrlMap.set(normalizePublicPath(uploaded.file), uploaded.cdnUrl);
  }

  console.log(`[runtime-assets] uploaded ${uploaded.file} -> ${uploaded.cdnUrl}`);
}

for (const [file, entry] of manifestEntries) {
  if (file.startsWith('public/')) {
    publicUrlMap.set(normalizePublicPath(file), entry.cdnUrl);
  }
}

const styleCatalog = [];
for (const repoPath of styleJsonFiles) {
  const absolute = path.join(ROOT, repoPath);
  const parsed = JSON.parse(await fs.readFile(absolute, 'utf-8'));
  const normalized = {
    ...parsed,
    imagePaths: Array.isArray(parsed.imagePaths)
      ? parsed.imagePaths
        .map((item) => normalizeRemoteRef(item, publicUrlMap, { dropMissing: true }))
        .filter(Boolean)
      : [],
    collageImageUrl: normalizeRemoteRef(parsed.collageImageUrl, publicUrlMap, { dropMissing: true }),
  };
  styleCatalog.push(normalized);

  const rewritten = replaceMappedRefs(parsed, publicUrlMap);
  await fs.writeFile(absolute, `${JSON.stringify(rewritten, null, 2)}\n`, 'utf-8');
}

const presetCatalog = [];
for (const repoPath of presetJsonFiles) {
  if (repoPath.endsWith('categories.json')) continue;
  const absolute = path.join(ROOT, repoPath);
  const parsed = JSON.parse(await fs.readFile(absolute, 'utf-8'));
  const normalizedCoverUrl = normalizeRemoteRef(parsed.coverUrl, publicUrlMap, { dropMissing: false }) || '';
  const normalized = {
    ...parsed,
    coverUrl: normalizedCoverUrl,
  };
  presetCatalog.push(normalized);

  const rewritten = replaceMappedRefs(parsed, publicUrlMap);
  await fs.writeFile(absolute, `${JSON.stringify(rewritten, null, 2)}\n`, 'utf-8');
}

const lorasCatalog = [];
for (const metadataRepoPath of loraMetadataFiles) {
  const absolute = path.join(ROOT, metadataRepoPath);
  const metadata = JSON.parse(await fs.readFile(absolute, 'utf-8'));
  const baseName = path.basename(metadataRepoPath, '.metadata.json');
  const previewRepoPath = `${path.posix.join('public', 'loras', `${baseName}.webp`)}`;
  const previewUrl = publicUrlMap.get(normalizePublicPath(previewRepoPath)) || '';
  const civitai = metadata.civitai && typeof metadata.civitai === 'object' ? metadata.civitai : {};
  const trainedWords = Array.isArray(civitai.trainedWords)
    ? civitai.trainedWords.map(String)
    : civitai.trainedWords
      ? [String(civitai.trainedWords)]
      : [];

  lorasCatalog.push({
    model_name: `${baseName}.safetensors`,
    preview_url: previewUrl,
    trainedWords,
    base_model: typeof metadata.base_model === 'string' ? metadata.base_model : '',
  });
}

async function uploadJsonCatalog(repoPath, value) {
  const buffer = Buffer.from(JSON.stringify(value, null, 2), 'utf-8');
  const uploaded = await uploadBuffer(repoPath, buffer, 'application/json');
  manifestEntries.set(uploaded.file, uploaded);
  console.log(`[runtime-assets] uploaded ${uploaded.file} -> ${uploaded.cdnUrl}`);
}

await uploadJsonCatalog('config/style-catalog.json', styleCatalog);
await uploadJsonCatalog('config/preset-catalog.json', presetCatalog);
await uploadJsonCatalog('config/loras-catalog.json', lorasCatalog);

const mergedEntries = [...manifestEntries.values()].sort((a, b) => a.file.localeCompare(b.file));
await fs.writeFile(
  RUNTIME_MANIFEST_PATH,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), entries: mergedEntries }, null, 2)}\n`,
  'utf-8',
);

const existingRedirects = await readJson(REDIRECTS_PATH, []);
const redirectMap = new Map(
  (Array.isArray(existingRedirects) ? existingRedirects : [])
    .filter((entry) => entry && typeof entry.source === 'string' && typeof entry.destination === 'string')
    .map((entry) => [entry.source, entry]),
);

for (const [publicPath, cdnUrl] of publicUrlMap) {
  redirectMap.set(publicPath, {
    source: publicPath,
    destination: cdnUrl,
    permanent: true,
  });
}

const mergedRedirects = [...redirectMap.values()].sort((a, b) => a.source.localeCompare(b.source));
await fs.writeFile(REDIRECTS_PATH, `${JSON.stringify(mergedRedirects, null, 2)}\n`, 'utf-8');

console.log(`\n[runtime-assets] Done. Uploaded ${uploadedEntries.length + 3} assets/catalogs.`);
console.log(`[runtime-assets] Manifest: ${path.relative(ROOT, RUNTIME_MANIFEST_PATH)}`);
console.log(`[runtime-assets] Redirects: ${path.relative(ROOT, REDIRECTS_PATH)}`);
